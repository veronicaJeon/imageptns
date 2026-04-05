export interface Translations {
  nav: {
    library: string;
    company: string;
    qa: string;
    login: string;
    signup: string;
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
