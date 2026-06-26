// NFHS-6 (2023-24) India national key indicators vs NFHS-5 (2019-21).
// Source: India & State/UT Fact Sheets, IIPS / MoHFW, NFHS-6, released May 2026.
// goodWhen: direction that represents an improvement for colour-coding the trend.

export type GoodWhen = "up" | "down" | "neutral";

export interface Indicator {
  label: string;
  n6: number; // NFHS-6 (2023-24) total
  n5: number; // NFHS-5 (2019-21) total
  unit?: string;
  goodWhen: GoodWhen;
  note?: string;
}

export interface Group {
  title: string;
  blurb?: string;
  rows: Indicator[];
}

export const GROUPS: Group[] = [
  {
    title: "Population, Households & Living Standards",
    rows: [
      { label: "Population below age 5 years", n6: 8.0, n5: 8.2, goodWhen: "neutral" },
      { label: "Population below age 15 years", n6: 25.5, n5: 26.5, goodWhen: "neutral" },
      { label: "Population age 60 years and above", n6: 12.9, n5: 11.8, goodWhen: "neutral", note: "India is ageing" },
      { label: "Households with electricity", n6: 98.3, n5: 96.8, goodWhen: "up" },
      { label: "Improved drinking-water source", n6: 96.5, n5: 95.9, goodWhen: "up" },
      { label: "Any member with health insurance / financing", n6: 60.2, n5: 41.0, goodWhen: "up", note: "Largest single gain" },
      { label: "Any member with a bank / post-office account", n6: 98.2, n5: 95.7, goodWhen: "up" },
      { label: "Females age 6+ who ever attended school", n6: 73.7, n5: 71.8, goodWhen: "up" },
    ],
  },
  {
    title: "Education & Digital Access (age 15–49)",
    rows: [
      { label: "Women with 10+ years of schooling", n6: 46.4, n5: 41.0, goodWhen: "up" },
      { label: "Men with 10+ years of schooling", n6: 54.6, n5: 50.2, goodWhen: "up" },
      { label: "Women who have ever used the internet", n6: 64.3, n5: 33.3, goodWhen: "up", note: "Nearly doubled" },
      { label: "Men who have ever used the internet", n6: 80.5, n5: 51.2, goodWhen: "up" },
    ],
  },
  {
    title: "Marriage & Fertility",
    rows: [
      { label: "Women 20–24 married before age 18", n6: 20.1, n5: 23.3, goodWhen: "down" },
      { label: "Men 25–29 married before age 21", n6: 15.9, n5: 17.7, goodWhen: "down" },
      { label: "Total Fertility Rate (children per woman)", n6: 2.0, n5: 2.0, goodWhen: "neutral", note: "At replacement level" },
      { label: "Women 15–19 already mothers or pregnant", n6: 6.7, n5: 6.8, goodWhen: "down" },
    ],
  },
  {
    title: "Family Planning (currently married women 15–49)",
    rows: [
      { label: "Using any contraceptive method", n6: 69.1, n5: 66.7, goodWhen: "up" },
      { label: "Using any modern method", n6: 52.7, n5: 56.4, goodWhen: "up", note: "Fell despite higher overall use" },
      { label: "Using any traditional method", n6: 16.4, n5: 10.3, goodWhen: "neutral", note: "Sharp rise" },
      { label: "Female sterilisation", n6: 36.5, n5: 37.9, goodWhen: "neutral" },
      { label: "Total unmet need for family planning", n6: 8.5, n5: 9.4, goodWhen: "down" },
    ],
  },
  {
    title: "Maternal Health & Delivery Care",
    rows: [
      { label: "Antenatal check-up in first trimester", n6: 76.2, n5: 70.0, goodWhen: "up" },
      { label: "Mothers with any antenatal care visit", n6: 95.9, n5: 92.6, goodWhen: "up" },
      { label: "Mothers with 4+ antenatal care visits", n6: 65.2, n5: 58.5, goodWhen: "up" },
      { label: "Consumed iron-folic acid 100+ days", n6: 54.9, n5: 44.1, goodWhen: "up" },
      { label: "Institutional births", n6: 90.6, n5: 88.6, goodWhen: "up" },
      { label: "Institutional births in a public facility", n6: 58.6, n5: 61.9, goodWhen: "neutral", note: "Shift toward private sector" },
      { label: "Births delivered by caesarean section", n6: 27.2, n5: 21.5, goodWhen: "neutral", note: "Well above WHO 10–15% norm" },
      { label: "C-section in private health facilities", n6: 54.1, n5: 47.4, goodWhen: "neutral" },
      { label: "Postnatal care within 2 days (mother)", n6: 82.8, n5: 78.0, goodWhen: "up" },
    ],
  },
  {
    title: "Child Immunisation & Survival (age 12–23 months)",
    rows: [
      { label: "Fully vaccinated (card or recall)", n6: 82.6, n5: 76.6, goodWhen: "up" },
      { label: "First dose measles-containing vaccine (MCV)", n6: 91.7, n5: 87.9, goodWhen: "up" },
      { label: "Second dose MCV (age 24–35 months)", n6: 71.8, n5: 58.6, goodWhen: "up" },
      { label: "Hepatitis-B birth dose", n6: 77.6, n5: 67.4, goodWhen: "up" },
      { label: "3 doses of rotavirus vaccine", n6: 85.4, n5: 36.4, goodWhen: "up", note: "National rollout impact" },
      { label: "Vitamin-A dose in last 6 months (9–35 mo)", n6: 74.6, n5: 71.2, goodWhen: "up" },
    ],
  },
  {
    title: "Child Nutrition (under age 5)",
    rows: [
      { label: "Breastfed within one hour of birth", n6: 50.1, n5: 41.8, goodWhen: "up" },
      { label: "Exclusively breastfed (under 6 months)", n6: 55.8, n5: 63.7, goodWhen: "up", note: "Declined" },
      { label: "Adequate diet, 6–23 months", n6: 15.3, n5: 11.0, goodWhen: "up", note: "Still very low" },
      { label: "Stunted (low height-for-age)", n6: 29.3, n5: 35.5, goodWhen: "down", note: "Biggest nutrition gain" },
      { label: "Wasted (low weight-for-height)", n6: 19.0, n5: 19.3, goodWhen: "down" },
      { label: "Severely wasted", n6: 5.2, n5: 7.7, goodWhen: "down" },
      { label: "Underweight (low weight-for-age)", n6: 31.8, n5: 32.1, goodWhen: "down" },
      { label: "Overweight (high weight-for-height)", n6: 1.3, n5: 3.4, goodWhen: "down" },
    ],
  },
  {
    title: "Adult Nutrition & Non-Communicable Disease (15–49 / 15+)",
    blurb: "The emerging story of NFHS-6: under-nutrition persists while obesity, high blood sugar and hypertension climb — India's double burden of malnutrition.",
    rows: [
      { label: "Women below normal BMI (<18.5)", n6: 19.7, n5: 18.7, goodWhen: "down" },
      { label: "Men below normal BMI (<18.5)", n6: 19.7, n5: 16.2, goodWhen: "down" },
      { label: "Women overweight or obese (BMI ≥25)", n6: 30.7, n5: 24.0, goodWhen: "down", note: "Rising fast" },
      { label: "Men overweight or obese (BMI ≥25)", n6: 27.3, n5: 22.9, goodWhen: "down", note: "Rising fast" },
      { label: "Women with high/very-high blood sugar*", n6: 17.8, n5: 13.5, goodWhen: "down", note: ">140 mg/dl or on medicine" },
      { label: "Men with high/very-high blood sugar*", n6: 20.9, n5: 15.6, goodWhen: "down", note: ">140 mg/dl or on medicine" },
      { label: "Women with elevated blood pressure**", n6: 19.4, n5: 21.3, goodWhen: "down" },
      { label: "Men with elevated blood pressure**", n6: 22.1, n5: 24.0, goodWhen: "down" },
    ],
  },
  {
    title: "Women's Empowerment & Gender",
    rows: [
      { label: "Participate in 3 key household decisions", n6: 89.0, n5: 88.7, goodWhen: "up" },
      { label: "Worked in last 12 months & paid in cash", n6: 30.8, n5: 25.4, goodWhen: "up" },
      { label: "Have a bank account they themselves use", n6: 89.0, n5: 78.6, goodWhen: "up" },
      { label: "Have a mobile phone they themselves use", n6: 63.6, n5: 53.9, goodWhen: "up" },
      { label: "Young women using hygienic menstrual protection", n6: 79.2, n5: 77.6, goodWhen: "up" },
      { label: "Ever experienced spousal violence (18–49)", n6: 22.3, n5: 29.2, goodWhen: "down", note: "Notable decline" },
    ],
  },
  {
    title: "Tobacco & Alcohol (age 15+)",
    rows: [
      { label: "Women who use any kind of tobacco", n6: 8.4, n5: 8.9, goodWhen: "down" },
      { label: "Men who use any kind of tobacco", n6: 36.3, n5: 38.0, goodWhen: "down" },
      { label: "Women who consume alcohol", n6: 1.1, n5: 1.3, goodWhen: "down" },
      { label: "Men who consume alcohol", n6: 18.9, n5: 18.7, goodWhen: "down" },
    ],
  },
];

// Vital rates NFHS does not estimate in the fact sheet — sourced from SRS (RGI).
export const SRS = [
  { label: "Infant Mortality Rate (IMR)", value: "25", unit: "per 1,000 live births", src: "SRS 2023 (RGI)" },
  { label: "IMR — Rural / Urban", value: "28 / 18", unit: "per 1,000", src: "SRS 2023 (RGI)" },
  { label: "Under-5 Mortality Rate", value: "32", unit: "per 1,000 live births", src: "SRS 2020 (RGI)" },
  { label: "Neonatal Mortality Rate", value: "20", unit: "per 1,000 live births", src: "SRS 2020 (RGI)" },
  { label: "Crude Birth Rate", value: "18.4", unit: "per 1,000 population", src: "SRS 2023 (RGI)" },
  { label: "Crude Death Rate", value: "6.4", unit: "per 1,000 population", src: "SRS 2023 (RGI)" },
];

export const FAQ = [
  {
    q: "What is NFHS-6?",
    a: "The National Family Health Survey (NFHS-6), 2023-24 is the sixth round of India's largest household survey on population, health and nutrition. It provides national, state/UT and district-level estimates on 101 key indicators and was conducted by the International Institute for Population Sciences (IIPS), Mumbai, under the Ministry of Health and Family Welfare (MoHFW).",
  },
  {
    q: "When was NFHS-6 released?",
    a: "The NFHS-6 (2023-24) fact sheets were released in May 2026. Fieldwork ran in two phases between 28 May 2023 and 31 December 2024 across 27 field agencies.",
  },
  {
    q: "What is the sample size of NFHS-6?",
    a: "NFHS-6 gathered information from 679,238 households, 716,397 women (age 15-49) and 100,977 men (age 15-54). It covered every Indian state and Union Territory except Manipur.",
  },
  {
    q: "What is India's Total Fertility Rate (TFR) in NFHS-6?",
    a: "India's TFR in NFHS-6 (2023-24) is 2.0 children per woman — the same as NFHS-5 and at the replacement level of 2.1 or below. Urban TFR is 1.6 and rural is 2.1.",
  },
  {
    q: "How is NFHS-6 different from NFHS-5?",
    a: "NFHS-6 keeps comparability with NFHS-5 but adds new topics such as Direct Bank Transfer (DBT) and Self-Help Group coverage, digital literacy, and expanded clinical testing including HIV. It is also the first NFHS conducted by IIPS without external technical or financial support.",
  },
  {
    q: "What are the biggest changes from NFHS-5 to NFHS-6?",
    a: "Health-insurance coverage jumped from 41% to 60%, women's internet use from 33% to 64%, child stunting fell from 35.5% to 29.3%, and rotavirus vaccination rose from 36% to 85%. At the same time, caesarean births (21.5% to 27.2%), adult obesity and high blood sugar all increased.",
  },
];
