// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ImagePartnersEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error AssetAlreadyRegistered();
    error AssetNotRegistered();
    error InvalidAddress();
    error InvalidArrayLength();
    error InvalidAmount();
    error NotOperator();
    error NothingToClaim();
    error OrderAlreadyPurchased();

    struct Asset {
        bytes32 contentHash;
        address photographer;
        string metadataURI;
        bool registered;
    }

    IERC20 public immutable usdc;
    address public treasury;
    uint16 public platformFeeBps;

    mapping(address => bool) public operators;
    mapping(bytes32 => Asset) public assets;
    mapping(bytes32 => bool) public purchasedOrders;
    mapping(address => uint256) public claimable;

    event AssetRegistered(
        bytes32 indexed assetId,
        bytes32 indexed contentHash,
        address indexed photographer,
        string metadataURI
    );
    event PurchaseCompleted(bytes32 indexed orderId, address indexed buyer, uint256 grossAmount, uint256 platformFee);
    event Claimed(address indexed photographer, uint256 amount);
    event OperatorSet(address indexed operator, bool allowed);
    event TreasurySet(address indexed treasury);
    event PlatformFeeSet(uint16 feeBps);

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator();
        _;
    }

    constructor(address usdc_, address treasury_, uint16 platformFeeBps_) Ownable(msg.sender) {
        if (usdc_ == address(0) || treasury_ == address(0)) revert InvalidAddress();
        if (platformFeeBps_ > 10_000) revert InvalidAmount();
        usdc = IERC20(usdc_);
        treasury = treasury_;
        platformFeeBps = platformFeeBps_;
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert InvalidAddress();
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert InvalidAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setPlatformFeeBps(uint16 feeBps) external onlyOwner {
        if (feeBps > 10_000) revert InvalidAmount();
        platformFeeBps = feeBps;
        emit PlatformFeeSet(feeBps);
    }

    function registerAsset(
        bytes32 assetId,
        bytes32 contentHash,
        address photographer,
        string calldata metadataURI
    ) external onlyOperator {
        if (assetId == bytes32(0) || contentHash == bytes32(0) || photographer == address(0)) revert InvalidAddress();
        if (assets[assetId].registered) revert AssetAlreadyRegistered();

        assets[assetId] = Asset({
            contentHash: contentHash,
            photographer: photographer,
            metadataURI: metadataURI,
            registered: true
        });

        emit AssetRegistered(assetId, contentHash, photographer, metadataURI);
    }

    function purchase(
        bytes32 orderId,
        bytes32[] calldata assetIds,
        address[] calldata photographers,
        uint256[] calldata grossAmounts
    ) external nonReentrant {
        if (orderId == bytes32(0)) revert InvalidAddress();
        if (purchasedOrders[orderId]) revert OrderAlreadyPurchased();
        if (assetIds.length == 0 || assetIds.length != photographers.length || assetIds.length != grossAmounts.length) {
            revert InvalidArrayLength();
        }

        purchasedOrders[orderId] = true;

        uint256 totalGross;
        uint256 totalFee;

        for (uint256 i = 0; i < assetIds.length; i++) {
            Asset memory asset = assets[assetIds[i]];
            if (!asset.registered) revert AssetNotRegistered();
            if (asset.photographer != photographers[i]) revert InvalidAddress();
            if (grossAmounts[i] == 0) revert InvalidAmount();

            uint256 fee = (grossAmounts[i] * platformFeeBps) / 10_000;
            uint256 photographerAmount = grossAmounts[i] - fee;
            claimable[photographers[i]] += photographerAmount;
            totalGross += grossAmounts[i];
            totalFee += fee;
        }

        usdc.safeTransferFrom(msg.sender, address(this), totalGross);
        if (totalFee > 0) usdc.safeTransfer(treasury, totalFee);

        emit PurchaseCompleted(orderId, msg.sender, totalGross, totalFee);
    }

    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }
}
