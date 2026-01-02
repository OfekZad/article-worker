// Research schema used for Firecrawl Deep Research (structured evidence)
export const researchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["coreClaims", "definitions", "numbers", "faq", "sources"],
  properties: {
    coreClaims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "confidence", "sources"],
        properties: {
          claim: { type: "string" },
          confidence: { enum: ["high", "medium", "low"] },
          sources: { type: "array", items: { type: "string" } },
        },
      },
    },
    definitions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "definition", "source"],
        properties: {
          term: { type: "string" },
          definition: { type: "string" },
          source: { type: "string" },
        },
      },
    },
    numbers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["metric", "value", "context", "source"],
        properties: {
          metric: { type: "string" },
          value: { type: "string" },
          context: { type: "string" },
          source: { type: "string" },
        },
      },
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "shortAnswer", "source"],
        properties: {
          question: { type: "string" },
          shortAnswer: { type: "string" },
          source: { type: "string" },
        },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "title", "publisher", "type"],
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          publisher: { type: "string" },
          type: { enum: ["gov", "major_news", "official_org", "academic", "commercial", "blog", "other"] },
        },
      },
    },
  },
};

const paragraphSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "isSpeakable", "entities"],
  properties: {
    text: { type: "string" },
    isSpeakable: { type: "boolean" },
    entities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "isBold"],
        properties: {
          text: { type: "string" },
          isBold: { type: "boolean" },
        },
      },
    },
  },
};

const bulletPointsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "count", "items"],
  properties: {
    type: { enum: ["unordered", "numbered"] },
    count: { type: "number" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "isSpeakable"],
        properties: {
          text: { type: "string" },
          isSpeakable: { type: "boolean" },
        },
      },
    },
  },
};

const metricsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["wordCount", "structure", "readability", "engagement"],
  properties: {
    wordCount: {
      type: "object",
      additionalProperties: false,
      required: ["total", "bySection", "readingTimeMinutes"],
      properties: {
        total: { type: "number" },
        bySection: {
          type: "object",
          additionalProperties: false,
          required: ["intro", "sections"],
          properties: {
            intro: { type: "number" },
            sections: { type: "array", items: { type: "number" } },
          },
        },
        readingTimeMinutes: { type: "number" },
      },
    },
    structure: {
      type: "object",
      additionalProperties: false,
      required: ["h1Count", "h2Count", "h3Count", "bulletListCount", "maxBulletItemsPerList"],
      properties: {
        h1Count: { type: "number" },
        h2Count: { type: "number" },
        h3Count: { type: "number" },
        bulletListCount: { type: "number" },
        maxBulletItemsPerList: { type: "number" }
      },
    },
    readability: {
      type: "object",
      additionalProperties: false,
      required: ["avgSentenceLength", "avgParagraphLength", "fleschKincaidGrade"],
      properties: {
        avgSentenceLength: { type: "number" },
        avgParagraphLength: { type: "number" },
        fleschKincaidGrade: { type: "number" },
      },
    },
    engagement: {
      type: "object",
      additionalProperties: false,
      required: ["estimatedClicks", "callToActionPresent", "shareableSections"],
      properties: {
        estimatedClicks: { type: "number" },
        callToActionPresent: { type: "boolean" },
        shareableSections: { type: "number" },
      },
    },
  },
};

// ✅ Corrected article schema: content.sectionsMeta exists (no duplicate keys)
export const articleSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id","slug","href",
    "title","description",
    "content",
    "author","publisher",
    "image",
    "datePublished","dateModified","displayDate","version",
    "seo","aeo",
    "metrics",
    "category","subcategories","tags","articleSection","primaryTopic",
    "schema",
    "language",
    "status","featured","relatedArticles",
    "analytics",
    "metadata",
  ],
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    href: { type: "string" },

    title: { type: "string" },
    description: { type: "string" },

    content: {
      type: "object",
      additionalProperties: false,
      required: ["intro","tableOfContents","sections","sectionsMeta","cta","tldr"],
      properties: {
        intro: {
          type: "object",
          additionalProperties: false,
          required: ["hook","wordCount"],
          properties: { hook: { type: "string" }, wordCount: { type: "number" } }
        },
        tableOfContents: {
          type: "object",
          additionalProperties: false,
          required: ["enabled","sections"],
          properties: {
            enabled: { type: "boolean" },
            sections: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id","title","level"],
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  level: { type: "number" }
                }
              }
            }
          }
        },
        sections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id","heading","paragraphs","bulletPoints","subsections","table","wordCount"],
            properties: {
              id: { type: "string" },
              heading: {
                type: "object",
                additionalProperties: false,
                required: ["level","text","type"],
                properties: {
                  level: { type: "number" },
                  text: { type: "string" },
                  type: { enum: ["main","subsection"] }
                }
              },
              paragraphs: { type: "array", items: paragraphSchema },
              bulletPoints: bulletPointsSchema,
              subsections: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["heading","paragraphs","bulletPoints"],
                  properties: {
                    heading: { type: "string" },
                    paragraphs: { type: "array", items: paragraphSchema },
                    bulletPoints: bulletPointsSchema
                  }
                }
              },
              table: {
                type: "object",
                additionalProperties: false,
                required: ["title","headers","rows"],
                properties: {
                  title: { type: "string" },
                  headers: { type: "array", items: { type: "string" } },
                  rows: { type: "array", items: { type: "array", items: { type: "string" } } }
                }
              },
              wordCount: { type: "number" }
            }
          }
        },
        sectionsMeta: {
          type: "object",
          additionalProperties: false,
          required: ["count","avgWordsPerSection"],
          properties: {
            count: { type: "number" },
            avgWordsPerSection: { type: "number" }
          }
        },
        cta: {
          type: "object",
          additionalProperties: false,
          required: ["heading","text","button"],
          properties: {
            heading: { type: "string" },
            text: { type: "string" },
            button: {
              type: "object",
              additionalProperties: false,
              required: ["text","href","type"],
              properties: {
                text: { type: "string" },
                href: { type: "string" },
                type: { enum: ["primary","secondary"] }
              }
            }
          }
        },
        tldr: {
          type: "object",
          additionalProperties: false,
          required: ["enabled","heading","points"],
          properties: {
            enabled: { type: "boolean" },
            heading: { type: "string" },
            points: { type: "array", items: { type: "string" } }
          }
        }
      }
    },

    author: { type: "object" },
    publisher: { type: "object" },
    image: { type: "object" },

    datePublished: { type: "string" },
    dateModified: { type: "string" },
    displayDate: { type: "string" },
    version: { type: "number" },

    seo: { type: "object" },
    aeo: { type: "object" },
    metrics: metricsSchema,

    category: { type: "string" },
    subcategories: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    articleSection: { type: "string" },
    primaryTopic: { type: "string" },

    schema: { type: "object" },

    language: {
      type: "object",
      additionalProperties: false,
      required: ["code","locale","direction","isRTL"],
      properties: {
        code: { type: "string" },
        locale: { type: "string" },
        direction: { enum: ["rtl","ltr"] },
        isRTL: { type: "boolean" }
      }
    },

    status: { enum: ["draft","published","archived"] },
    featured: { type: "boolean" },
    relatedArticles: { type: "array", items: { type: "string" } },

    analytics: {
      type: "object",
      additionalProperties: false,
      required: ["views","avgTimeOnPage","bounceRate","conversionRate"],
      properties: {
        views: { type: "number" },
        avgTimeOnPage: { type: "number" },
        bounceRate: { type: "number" },
        conversionRate: { type: "number" }
      }
    },

    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["canonicalUrl","ogImage","ogTitle","ogDescription","twitterCard","robots"],
      properties: {
        canonicalUrl: { type: "string" },
        ogImage: { type: "string" },
        ogTitle: { type: "string" },
        ogDescription: { type: "string" },
        twitterCard: { type: "string" },
        robots: { type: "string" }
      }
    }
  }
};
