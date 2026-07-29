export interface Translations {
  nav: {
    library: string;
    company: string;
    qa: string;
    login: string;
    signup: string;
  };
  auth: {
    login: {
      title: string; subtitle: string; googleBtn: string; divider: string;
      emailLabel: string; emailPlaceholder: string; passwordLabel: string;
      passwordPlaceholder: string; forgotPassword: string; submitBtn: string;
      noAccount: string; signupLink: string; errorOAuth: string; errorCredentials: string;
    };
    signup: {
      title: string; subtitle: string; roleLabel: string;
      roleBuyer: string; roleBuyerDesc: string; rolePhotographer: string; rolePhotographerDesc: string;
      googleBtn: string; divider: string; nameLabel: string; namePlaceholder: string;
      emailLabel: string; emailPlaceholder: string; passwordLabel: string;
      passwordPlaceholder: string; submitBtn: string; hasAccount: string; loginLink: string;
      terms: string; termsLink: string; and: string; privacyLink: string;
    };
    brand: { tagline: string; quote: string };
  };
  library: {
    hero: {
      headline: string;
      sub: string;
      searchPlaceholder: string;
    };
    stats: { assets: string; photographers: string; countries: string };
    categories: {
      all: string;
      nature: string;
      people: string;
      editorial: string;
      urban: string;
      abstract: string;
      architecture: string;
    };
    sort: {
      label: string;
      newest: string;
      popular: string;
      relevant: string;
    };
    results: string;
    noResults: string;
    addToCart: string;
    favorite: string;
    quickView: string;
  };
  support: {
    hero: { headline: string; sub: string; searchPlaceholder: string };
    categories: { all: string; account: string; licensing: string; billing: string; technical: string };
    faqs: { question: string; answer: string }[];
    contact: { title: string; sub: string; btn: string };
    noResults: string;
  };
  dashboard: {
    nav: { overview: string; sourcing: string; favorites: string; orders: string; uploads: string; requests: string; blockchain: string; earnings: string; settings: string };
    role: { buyer: string; photographer: string };
    overview: {
      greeting: string;
      statFavorites: string; statOrders: string; statCart: string;
      statUploads: string; statEarnings: string; statPending: string;
      recentTitle: string; recentEmpty: string;
      browseBtn: string; uploadBtn: string;
    };
    favorites: { title: string; empty: string; emptyBtn: string; removeBtn: string };
    orders: {
      title: string;
      empty: string;
      cols: { image: string; license: string; date: string; amount: string; status: string };
      download: string;
      recovery: {
        txPlaceholder: string;
        txLabel: string;
        retry: string;
        retrying: string;
        missingTx: string;
        confirmFailed: string;
        refreshFailed: string;
        networkFailed: string;
      };
    };
    uploads: { title: string; uploadBtn: string; empty: string; cols: { image: string; status: string; views: string; sales: string; uploaded: string }; statuses: { approved: string; pending: string; rejected: string } };
    earnings: { title: string; statTotal: string; statMonth: string; statPending: string; payoutBtn: string; historyTitle: string };
    settings: { title: string; sections: { profile: string; account: string; notifications: string; danger: string }; saveBtn: string; nameLabel: string; emailLabel: string; bioLabel: string; phoneLabel: string; regionsLabel: string; regionsPlaceholder: string; regionsHint: string; deleteAccount: string; deleteBtn: string };
  };
  cart: {
    title: string; empty: string; emptyBtn: string;
    license: string; remove: string; subtotal: string; vat: string; total: string;
    checkoutBtn: string; continueBtn: string;
    licenseTypes: { editorial: string; commercial: string; extended: string };
    alreadyInCart: string; addedToCart: string;
  };
  checkout: {
    title: string; orderSummary: string; paymentMethod: string;
    cardNumber: string; expiry: string; cvc: string; cardName: string;
    billingTitle: string; name: string; email: string; company: string;
    submitBtn: string; secureNote: string;
    success: { title: string; sub: string; dashboardBtn: string; libraryBtn: string };
  };
  forgotPassword: {
    title: string; sub: string; emailLabel: string; emailPlaceholder: string;
    submitBtn: string; backToLogin: string; sent: string; sentSub: string;
  };
  pricing: {
    hero: { headline: string; sub: string };
    toggle: { monthly: string; annual: string; discount: string };
    plans: { name: string; price: string; priceAnn: string; desc: string; cta: string; features: string[] }[];
    enterprise: { title: string; sub: string; btn: string };
  };
  legal: {
    lastUpdated: string;
    backBtn: string;
    comingSoon: string;
    comingSoonSub: string;
  };
  contact: {
    hero: { headline: string; sub: string };
    form: { name: string; namePlaceholder: string; email: string; emailPlaceholder: string; subject: string; subjectPlaceholder: string; message: string; messagePlaceholder: string; submit: string };
    info: { title: string; email: string; hours: string; hoursVal: string; response: string; responseVal: string };
    success: string;
  };
  imageDetail: {
    by: string;
    category: string;
    resolution: string;
    license: string;
    licenseTypes: { editorial: string; commercial: string; extended: string };
    prices: { editorial: string; commercial: string; extended: string };
    addToCart: string;
    favorite: string;
    share: string;
    similarTitle: string;
    details: { format: string; size: string; uploaded: string; id: string; shotAt: string; shotLocation: string };
    copied: string;
  };
  home: {
    hero: {
      badge: string;
      headline1: string;
      headline2: string;
      description: string;
      scroll: string;
    };
    about: {
      headline1: string;
      headline2: string;
      body: string;
      floatTitle: string;
      floatBody: string;
    };
    values: {
      title: string;
      items: { title: string; desc: string }[];
    };
    timeline: {
      title: string;
      subtitle: string;
      items: { year: string; title: string; desc: string }[];
    };
    partners: { label: string };
    cta: {
      headline1: string;
      headline2: string;
      browse: string;
      contact: string;
    };
  };
  photographerProfile: {
    memberSince: string;
    images: string;
    totalSales: string;
    totalViews: string;
    portfolio: string;
    noImages: string;
    notFound: string;
    backToLibrary: string;
  };
  footer: {
    tagline: string;
    copyright: string;
    company: { title: string; address: string; email: string };
    sections: { Resources: string; Legal: string; Company: string };
    links: {
      imageLibrary: string;
      qa: string;
      pricing: string;
      blog: string;
      terms: string;
      privacy: string;
      licenseGuide: string;
      cookie: string;
      about: string;
      careers: string;
      press: string;
      contact: string;
    };
  };
}

export const en: Translations = {
  nav: {
    library: "Library",
    company: "Company",
    qa: "Q&A",
    login: "Login",
    signup: "Sign Up",
  },
  auth: {
    login: {
      title: "Welcome back.",
      subtitle: "Sign in to access your curated collections.",
      googleBtn: "Continue with Google",
      divider: "or sign in with email",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Your password",
      forgotPassword: "Forgot password?",
      submitBtn: "Sign in",
      noAccount: "Don't have an account?",
      signupLink: "Sign up",
      errorOAuth: "Authentication failed. Please try again.",
      errorCredentials: "Invalid email or password.",
    },
    signup: {
      title: "Join Image Partners.",
      subtitle: "Choose how you'd like to use the platform.",
      roleLabel: "I am a…",
      roleBuyer: "Buyer",
      roleBuyerDesc: "Find & license imagery",
      rolePhotographer: "Photographer",
      rolePhotographerDesc: "Submit & monetize work",
      googleBtn: "Continue with Google",
      divider: "or sign up with email",
      nameLabel: "Full Name",
      namePlaceholder: "Jane Smith",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "At least 8 characters",
      submitBtn: "Create account",
      hasAccount: "Already have an account?",
      loginLink: "Sign in",
      terms: "By creating an account you agree to our",
      termsLink: "Terms of Service",
      and: "and",
      privacyLink: "Privacy Policy",
    },
    brand: {
      tagline: "Photographs are proof of the past.",
      quote: "\"Every image is a story waiting to be told.\"",
    },
  },
  library: {
    hero: {
      headline: "EXPLORE THE ARCHIVE",
      sub: "Curated imagery for the world's leading publishers",
      searchPlaceholder: "Keyword, subject",
    },
    stats: { assets: "1.2M+ Assets", photographers: "4,800+ Photographers", countries: "40+ Countries" },
    categories: {
      all: "All",
      nature: "Nature",
      people: "People",
      editorial: "Editorial",
      urban: "Urban",
      abstract: "Abstract",
      architecture: "Architecture",
    },
    sort: {
      label: "Sort by",
      newest: "Newest",
      popular: "Most Popular",
      relevant: "Most Relevant",
    },
    results: "images",
    noResults: "No images found. Try a different search.",
    addToCart: "Add to cart",
    favorite: "Favorite",
    quickView: "Quick view",
  },
  support: {
    hero: {
      headline: "How can we help?",
      sub: "Browse common questions or search for a specific topic.",
      searchPlaceholder: "Search articles…",
    },
    categories: { all: "All", account: "Account", licensing: "Licensing", billing: "Billing", technical: "Technical" },
    faqs: [
      { question: "How do I download a licensed image?", answer: "Free licenses open download access after confirming the terms. Paid licenses become downloadable from Dashboard → Orders after an administrator verifies the bank transfer." },
      { question: "What license types are available?", answer: "Each image may use the Image Partners standard license, editorial terms, or Creative Commons terms. Review the image details, License Guide, and order statement together." },
      { question: "Can I use images for social media?", answer: "It depends on the image license and intended use. Check commercial-use, attribution, and modification conditions, and contact us before use if the scope is unclear." },
      { question: "How do I submit my photography?", answer: "Apply as a photographer after signup. Once approved, you can submit images through Dashboard → Uploads for operational review." },
      { question: "What file formats do you accept?", answer: "The current upload screen accepts JPEG files up to 100 MB and 120 megapixels each. Rights information, title, description, tags, and capture details are required." },
      { question: "When and how do photographers get paid?", answer: "Revenue-share rates and settlement schedules are not final yet. The applicable terms will be disclosed and agreed before live sales and payouts begin." },
      { question: "Are subscriptions available?", answer: "Subscriptions and online card payments are not publicly available yet. Paid image licenses currently use bank-transfer requests followed by deposit verification." },
      { question: "Are any images free to use?", answer: "Images marked free for all, free for education, or with Creative Commons terms may be used within those terms. A free label does not mean copyright is waived or use is unrestricted." },
    ],
    contact: { title: "Still need help?", sub: "Our editorial support team responds within one business day.", btn: "Contact Support" },
    noResults: "No articles found for that search.",
  },
  dashboard: {
    nav: { overview: "Overview", sourcing: "My sourcing requests", favorites: "Favorites", orders: "Orders", uploads: "Uploads", requests: "Team requests", blockchain: "Blockchain", earnings: "Earnings", settings: "Settings" },
    role: { buyer: "Buyer", photographer: "Photographer" },
    overview: {
      greeting: "Good to see you",
      statFavorites: "Favorites", statOrders: "Orders", statCart: "In Cart",
      statUploads: "Uploads", statEarnings: "Earnings", statPending: "Pending Review",
      recentTitle: "Recent Activity",
      recentEmpty: "No recent activity yet.",
      browseBtn: "Browse Library",
      uploadBtn: "Upload Images",
    },
    favorites: { title: "My Favorites", empty: "You haven't saved any images yet.", emptyBtn: "Browse Library", removeBtn: "Remove" },
    orders: {
      title: "Order History",
      empty: "No orders yet.",
      cols: { image: "Image", license: "License", date: "Date", amount: "Amount", status: "Status" },
      download: "Download",
      recovery: {
        txPlaceholder: "Tx hash",
        txLabel: "Transaction hash for order",
        retry: "Retry",
        retrying: "Retrying",
        missingTx: "Enter the Base USDC transaction hash from your wallet or order history.",
        confirmFailed: "Could not confirm this Base USDC payment. Check the transaction hash and try again.",
        refreshFailed: "Payment was confirmed, but the order list could not refresh. Reload this page to see the latest status.",
        networkFailed: "Could not confirm this Base USDC payment. Check your connection and try again.",
      },
    },
    uploads: { title: "My Uploads", uploadBtn: "New Upload", empty: "No uploads yet. Start sharing your work.", cols: { image: "Image", status: "Status", views: "Views", sales: "Sales", uploaded: "Uploaded" }, statuses: { approved: "Approved", pending: "Pending", rejected: "Rejected" } },
    earnings: { title: "Earnings", statTotal: "Total Earned", statMonth: "This Month", statPending: "Pending Payout", payoutBtn: "Request Payout", historyTitle: "Payout History" },
    settings: { title: "Settings", sections: { profile: "Profile", account: "Account", notifications: "Notifications", danger: "Danger Zone" }, saveBtn: "Save Changes", nameLabel: "Full Name", emailLabel: "Email", bioLabel: "Bio", phoneLabel: "Phone Number", regionsLabel: "Primary Activity Regions", regionsPlaceholder: "Seoul\nBusan\nJeju Island", regionsHint: "Enter one region per line, or separate regions with commas.", deleteAccount: "Permanently delete your account and all associated data.", deleteBtn: "Delete Account" },
  },
  cart: {
    title: "Cart", empty: "Your cart is empty.", emptyBtn: "Browse Library",
    license: "License", remove: "Remove", subtotal: "Subtotal", vat: "VAT (10%)", total: "Total",
    checkoutBtn: "Proceed to Checkout", continueBtn: "Continue Shopping",
    licenseTypes: { editorial: "Editorial", commercial: "Commercial", extended: "Extended" },
    alreadyInCart: "Already in cart — license updated.", addedToCart: "Added to cart.",
  },
  checkout: {
    title: "Checkout", orderSummary: "Order Summary", paymentMethod: "Payment Method",
    cardNumber: "Card Number", expiry: "Expiry", cvc: "CVC", cardName: "Name on Card",
    billingTitle: "Billing Information", name: "Full Name", email: "Email", company: "Company (optional)",
    submitBtn: "Pay Now", secureNote: "Secured by Toss Payments. Your card info is never stored.",
    success: { title: "Payment complete!", sub: "Your license files are ready to download.", dashboardBtn: "Go to Orders", libraryBtn: "Continue browsing" },
  },
  forgotPassword: {
    title: "Reset your password.", sub: "Enter your email and we'll send a reset link.",
    emailLabel: "Email", emailPlaceholder: "you@example.com",
    submitBtn: "Send reset link", backToLogin: "Back to login",
    sent: "Check your inbox.", sentSub: "If that email exists in our system, a reset link has been sent.",
  },
  pricing: {
    hero: { headline: "Simple, transparent pricing.", sub: "Start free. Scale as you grow. Cancel anytime." },
    toggle: { monthly: "Monthly", annual: "Annual", discount: "Save 20%" },
    plans: [
      { name: "Editorial Free", price: "₩0", priceAnn: "₩0", desc: "For individuals exploring the archive.", cta: "Get started free", features: ["5 editorial downloads / month", "Standard resolution", "Watermarked previews", "Email support"] },
      { name: "Professional", price: "₩89,000", priceAnn: "₩71,000", desc: "For editors and content creators.", cta: "Start free trial", features: ["50 downloads / month", "Full resolution files", "Commercial license included", "Priority support", "API access"] },
      { name: "Enterprise", price: "Custom", priceAnn: "Custom", desc: "For publishers and media groups.", cta: "Contact sales", features: ["Unlimited downloads", "Custom licensing terms", "Dedicated account manager", "SLA guarantee", "On-site training"] },
    ],
    enterprise: { title: "Need a custom plan?", sub: "We work directly with major publishers to create tailored licensing agreements.", btn: "Talk to sales" },
  },
  legal: {
    lastUpdated: "Last updated",
    backBtn: "Back",
    comingSoon: "Coming Soon",
    comingSoonSub: "This document is being finalized by our legal team. Please check back shortly.",
  },
  contact: {
    hero: { headline: "Get in touch.", sub: "Our editorial team is ready to help you find the right imagery." },
    form: { name: "Full Name", namePlaceholder: "Jane Smith", email: "Email", emailPlaceholder: "you@example.com", subject: "Subject", subjectPlaceholder: "How can we help?", message: "Message", messagePlaceholder: "Tell us about your project…", submit: "Send Message" },
    info: { title: "Contact Information", email: "contact@imagepartners.kr", hours: "Business Hours", hoursVal: "Mon–Fri, 9AM–6PM (KST)", response: "Response Time", responseVal: "Within 1 business day" },
    success: "Message sent! We'll be in touch within one business day.",
  },
  imageDetail: {
    by: "by",
    category: "Category",
    resolution: "Resolution",
    license: "Choose License",
    licenseTypes: { editorial: "Editorial", commercial: "Commercial", extended: "Extended" },
    prices: { editorial: "₩15,000", commercial: "₩55,000", extended: "₩180,000" },
    addToCart: "Add to Cart",
    favorite: "Save",
    share: "Share",
    similarTitle: "Similar Images",
    details: { format: "Format", size: "File Size", uploaded: "Uploaded", id: "Asset ID", shotAt: "Shot On", shotLocation: "Location" },
    copied: "Link copied!",
  },
  home: {
    hero: {
      badge: "",
      headline1: "THE IMAGE YOU NEED,",
      headline2: "WITH THE CONTEXT BEHIND IT.",
      description:
        "Verified source and context help publishing and media projects reach a more complete final form.",
      scroll: "Scroll to explore",
    },
    about: {
      headline1: "The Digital",
      headline2: "Curator.",
      body: "Image Partners handles only carefully verified imagery. From the flood of visual data online, we work to provide the precise cut your project needs.",
      floatTitle: "",
      floatBody: "",
    },
    values: {
      title: "",
      items: [
        {
          title: "Authenticity First",
          desc: "Every image in our archive is rigorously verified for metadata accuracy and legal clearance, ensuring peace of mind for global publishers.",
        },
        {
          title: "Verified Captions",
          desc: "We treat source clarity and caption accuracy as essential parts of each image.",
        },
        {
          title: "Global Network",
          desc: "We work with global partners to preserve local context and perspective.",
        },
      ],
    },
    timeline: {
      title: "The Legacy",
      subtitle: "Three decades of visual storytelling.",
      items: [
        {
          year: "Verified",
          title: "Company History",
          desc: "Company history copy is being verified before public launch.",
        },
        {
          year: "2008",
          title: "Digital Expansion",
          desc: "Completion of our first 10-million-image digitization project, becoming the primary partner for major European newspapers.",
        },
        {
          year: "2024",
          title: "Next Gen Archives",
          desc: "Implementation of high-speed AI curation, allowing for instantaneous visual search across our global curated collections.",
        },
      ],
    },
    partners: { label: "Trusted by industry leaders" },
    cta: {
      headline1: "WE FIND THE CUT",
      headline2: "THAT GIVES YOUR STORY LIFE.",
      browse: "Browse our library",
      contact: "Contact",
    },
  },
  photographerProfile: {
    memberSince: "Member since",
    images: "Images",
    totalSales: "Total Sales",
    totalViews: "Total Views",
    portfolio: "Portfolio",
    noImages: "No approved images yet.",
    notFound: "Photographer not found.",
    backToLibrary: "← Back to Library",
  },
  footer: {
    tagline: "Discover carefully selected images that give your story life.",
    copyright: "© 2026 Image Partners. All rights reserved.",
    company: {
      title: "Company",
      address: "No. 1, 57, Geobukgol-ro 21-gil, Seodaemun-gu, Seoul",
      email: "contact@imagepartners.kr",
    },
    sections: { Resources: "Resources", Legal: "Legal", Company: "Company" },
    links: {
      imageLibrary: "Image Library",
      qa: "Q&A",
      pricing: "Pricing",
      blog: "Blog",
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      licenseGuide: "License Guide",
      cookie: "Cookie Policy",
      about: "About Us",
      careers: "Careers",
      press: "Press",
      contact: "Contact",
    },
  },
};
