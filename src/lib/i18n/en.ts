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
    nav: { overview: string; favorites: string; orders: string; uploads: string; earnings: string; settings: string };
    role: { buyer: string; photographer: string };
    overview: {
      greeting: string;
      statFavorites: string; statOrders: string; statCart: string;
      statUploads: string; statEarnings: string; statPending: string;
      recentTitle: string; recentEmpty: string;
      browseBtn: string; uploadBtn: string;
    };
    favorites: { title: string; empty: string; emptyBtn: string; removeBtn: string };
    orders: { title: string; empty: string; cols: { image: string; license: string; date: string; amount: string; status: string }; download: string };
    uploads: { title: string; uploadBtn: string; empty: string; cols: { image: string; status: string; views: string; sales: string; uploaded: string }; statuses: { approved: string; pending: string; rejected: string } };
    earnings: { title: string; statTotal: string; statMonth: string; statPending: string; payoutBtn: string; historyTitle: string };
    settings: { title: string; sections: { profile: string; account: string; notifications: string; danger: string }; saveBtn: string; nameLabel: string; emailLabel: string; bioLabel: string; deleteAccount: string; deleteBtn: string };
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
    details: { format: string; size: string; uploaded: string; id: string };
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
  footer: {
    tagline: string;
    copyright: string;
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
      roleBuyer: "Image Buyer",
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
      tagline: "The world's most curated image archive.",
      quote: "\"Every image is a story waiting to be told.\"",
    },
  },
  library: {
    hero: {
      headline: "EXPLORE THE ARCHIVE",
      sub: "Curated imagery for the world's leading publishers",
      searchPlaceholder: "Search by keyword, subject, or photographer…",
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
      { question: "How do I download a licensed image?", answer: "After purchasing a license, go to Dashboard → Orders. Click Download next to the image. High-resolution files are available immediately after payment." },
      { question: "What license types are available?", answer: "We offer three tiers: Editorial (news & editorial use), Commercial (advertising & marketing), and Extended (unlimited print runs, merchandise). See our License Guide for full details." },
      { question: "Can I use images for social media?", answer: "Yes. A Commercial license covers digital use including social media, websites, and digital advertising. Editorial licenses are limited to news reporting and educational content." },
      { question: "How do I submit my photography?", answer: "Sign up as a Photographer, complete identity verification, then upload via Dashboard → Uploads. Images are reviewed within 5–7 business days." },
      { question: "What file formats do you accept?", answer: "We accept RAW, TIFF, and JPEG files at a minimum of 24 megapixels. Images must be technically sound — no excessive noise, chromatic aberration, or artifacting." },
      { question: "When and how do photographers get paid?", answer: "Earnings are settled on the 15th of each month via bank transfer or PayPal for balances over ₩50,000 (or $40 USD). You can track all earnings in your Photographer Dashboard." },
      { question: "How do I cancel a subscription?", answer: "Go to Dashboard → Settings → Subscription and click Cancel Plan. Your access continues until the end of the billing period. No partial refunds are issued." },
      { question: "Is there a free trial?", answer: "New accounts receive 5 complimentary Editorial license downloads. No credit card required to start." },
    ],
    contact: { title: "Still need help?", sub: "Our editorial support team responds within one business day.", btn: "Contact Support" },
    noResults: "No articles found for that search.",
  },
  dashboard: {
    nav: { overview: "Overview", favorites: "Favorites", orders: "Orders", uploads: "Uploads", earnings: "Earnings", settings: "Settings" },
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
    orders: { title: "Order History", empty: "No orders yet.", cols: { image: "Image", license: "License", date: "Date", amount: "Amount", status: "Status" }, download: "Download" },
    uploads: { title: "My Uploads", uploadBtn: "New Upload", empty: "No uploads yet. Start sharing your work.", cols: { image: "Image", status: "Status", views: "Views", sales: "Sales", uploaded: "Uploaded" }, statuses: { approved: "Approved", pending: "Pending", rejected: "Rejected" } },
    earnings: { title: "Earnings", statTotal: "Total Earned", statMonth: "This Month", statPending: "Pending Payout", payoutBtn: "Request Payout", historyTitle: "Payout History" },
    settings: { title: "Settings", sections: { profile: "Profile", account: "Account", notifications: "Notifications", danger: "Danger Zone" }, saveBtn: "Save Changes", nameLabel: "Full Name", emailLabel: "Email", bioLabel: "Bio", deleteAccount: "Permanently delete your account and all associated data.", deleteBtn: "Delete Account" },
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
    info: { title: "Contact Information", email: "contact@imagepartners.com", hours: "Business Hours", hoursVal: "Mon–Fri, 9AM–6PM (KST)", response: "Response Time", responseVal: "Within 1 business day" },
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
    details: { format: "Format", size: "File Size", uploaded: "Uploaded", id: "Asset ID" },
  },
  home: {
    hero: {
      badge: "Est. 1994",
      headline1: "WE CURATE",
      headline2: "VISUAL EXCELLENCE.",
      description:
        "A premier archival and contemporary image agency dedicated to the publishing industry, bridging the gap between historical significance and modern storytelling.",
      scroll: "Scroll to explore",
    },
    about: {
      headline1: "The Digital",
      headline2: "Curator.",
      body: "In an era of infinite imagery, IMAGE PARTNERS stands as a filter for quality. We are not a warehouse; we are a gallery. Our mission is to provide editors and creators with more than just assets—we provide context, narrative, and soul.",
      floatTitle: "Our Core Expertise",
      floatBody:
        "Specializing in high-resolution archival restoration and contemporary editorial licensing for international print media.",
    },
    values: {
      title: "",
      items: [
        {
          title: "Authenticity First",
          desc: "Every image in our archive is rigorously verified for metadata accuracy and legal clearance, ensuring peace of mind for global publishers.",
        },
        {
          title: "Restoration Mastery",
          desc: "Our in-house digital preservation lab breathes new life into historical negatives using proprietary AI-assisted enhancement tools.",
        },
        {
          title: "Global Network",
          desc: "With partners in 40+ countries, we provide a truly international perspective on culture, history, and news through local eyes.",
        },
      ],
    },
    timeline: {
      title: "The Legacy",
      subtitle: "Three decades of visual storytelling.",
      items: [
        {
          year: "1994",
          title: "Founding",
          desc: "IMAGE PARTNERS launched as a specialized boutique agency for documentary photography in London, focusing on historical archives.",
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
      headline1: "READY TO DEFINE YOUR",
      headline2: "VISUAL NARRATIVE?",
      browse: "Browse our library",
      contact: "Contact sales",
    },
  },
  footer: {
    tagline:
      "Elevating the world's publishing standards through curated visual excellence since 1994.",
    copyright: "© 2026 Image Partners. All rights reserved.",
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
