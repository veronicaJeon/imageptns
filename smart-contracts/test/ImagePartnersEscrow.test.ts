import { expect } from "chai";
import { ethers } from "hardhat";

describe("ImagePartnersEscrow", function () {
  async function deployFixture() {
    const [owner, operator, treasury, buyer, photographer, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const Escrow = await ethers.getContractFactory("ImagePartnersEscrow");
    const escrow = await Escrow.deploy(await usdc.getAddress(), treasury.address, 2000);
    await escrow.setOperator(operator.address, true);

    await usdc.mint(buyer.address, 1_000_000_000n);

    return { owner, operator, treasury, buyer, photographer, other, usdc, escrow };
  }

  it("registers an asset by an authorized operator", async function () {
    const { operator, photographer, escrow } = await deployFixture();
    const assetId = ethers.id("IP-00001");
    const contentHash = ethers.id("content");

    await expect(
      escrow.connect(operator).registerAsset(assetId, contentHash, photographer.address, "ipfs://metadata"),
    )
      .to.emit(escrow, "AssetRegistered")
      .withArgs(assetId, contentHash, photographer.address, "ipfs://metadata");
  });

  it("rejects duplicate asset registration", async function () {
    const { operator, photographer, escrow } = await deployFixture();
    const assetId = ethers.id("IP-00001");
    const contentHash = ethers.id("content");

    await escrow.connect(operator).registerAsset(assetId, contentHash, photographer.address, "ipfs://metadata");

    await expect(
      escrow.connect(operator).registerAsset(assetId, contentHash, photographer.address, "ipfs://metadata"),
    ).to.be.revertedWithCustomError(escrow, "AssetAlreadyRegistered");
  });

  it("allocates purchase funds to treasury and photographer claim balance", async function () {
    const { operator, treasury, buyer, photographer, usdc, escrow } = await deployFixture();
    const assetId = ethers.id("IP-00001");
    const orderId = ethers.id("ORD-000001");
    const grossAmount = 100_000_000n;

    await escrow.connect(operator).registerAsset(assetId, ethers.id("content"), photographer.address, "ipfs://metadata");
    await usdc.connect(buyer).approve(await escrow.getAddress(), grossAmount);

    await expect(escrow.connect(buyer).purchase(orderId, [assetId], [photographer.address], [grossAmount]))
      .to.emit(escrow, "PurchaseCompleted")
      .withArgs(orderId, buyer.address, grossAmount, 20_000_000n);

    expect(await usdc.balanceOf(treasury.address)).to.equal(20_000_000n);
    expect(await escrow.claimable(photographer.address)).to.equal(80_000_000n);
  });

  it("lets photographers claim their balance", async function () {
    const { operator, buyer, photographer, usdc, escrow } = await deployFixture();
    const assetId = ethers.id("IP-00001");
    const orderId = ethers.id("ORD-000001");
    const grossAmount = 100_000_000n;

    await escrow.connect(operator).registerAsset(assetId, ethers.id("content"), photographer.address, "ipfs://metadata");
    await usdc.connect(buyer).approve(await escrow.getAddress(), grossAmount);
    await escrow.connect(buyer).purchase(orderId, [assetId], [photographer.address], [grossAmount]);

    await expect(escrow.connect(photographer).claim())
      .to.emit(escrow, "Claimed")
      .withArgs(photographer.address, 80_000_000n);

    expect(await usdc.balanceOf(photographer.address)).to.equal(80_000_000n);
    expect(await escrow.claimable(photographer.address)).to.equal(0n);
  });
});
