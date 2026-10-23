/**
 * Real CBSE Class 10 board questions, by chapter.
 *
 * The mock exam has always been able to imitate a board paper; this file is
 * the part that does not imitate. Each entry is a question from a CBSE Class 10
 * board paper between 2020 and 2025, tagged with its paper code so the student
 * can check it against the original. When Class 10 sits a "Board simulation",
 * these are used first and the model writes the rest of the paper.
 *
 * Two honesty notes shape the data:
 *
 *  - The 2021 board papers were cancelled, and 2022 used a two-term format, so
 *    the years present here are 2020, 2023, 2024 and 2025.
 *  - The wording is the published question, lightly re-typed. Answer points are
 *    checked against the marking scheme, not copied from it, so they read as
 *    points a teacher would tick rather than official scheme text.
 */

export interface BankQuestion {
  chapter: string;
  type: "mcq" | "short" | "long";
  marks: number;
  prompt: string;
  options?: string[];
  answerIndex?: number;
  explanation?: string;
  modelAnswer?: string;
  markingPoints?: string[];
  /** Paper it appeared in, e.g. "CBSE 2024 · 31/4/1 · Q6". */
  origin: string;
}

const SCIENCE: BankQuestion[] = [
  {
    chapter: "Chemical Reactions and Equations",
    type: "mcq",
    marks: 1,
    prompt:
      "Which of the following statements about the burning of a magnesium ribbon in air is false?",
    options: [
      "It burns with a dazzling white flame.",
      "The product formed is magnesium oxide.",
      "The reaction is endothermic.",
      "It is a combination reaction.",
    ],
    answerIndex: 2,
    explanation:
      "Burning magnesium releases heat — it is exothermic. Magnesium combines with oxygen, so it is also a combination reaction.",
    origin: "CBSE 2025 · 31/6/1 · Q3",
  },
  {
    chapter: "Chemical Reactions and Equations",
    type: "mcq",
    marks: 1,
    prompt: "The reaction between zinc and dilute acetic acid is an example of a:",
    options: [
      "Combination reaction",
      "Decomposition reaction",
      "Displacement reaction",
      "Double displacement reaction",
    ],
    answerIndex: 2,
    explanation:
      "Zinc, the more reactive metal, displaces hydrogen from acetic acid and zinc acetate is formed.",
    origin: "CBSE 2024 · 31/4/1 · Q1",
  },
  {
    chapter: "Chemical Reactions and Equations",
    type: "short",
    marks: 2,
    prompt:
      "Is the following reaction a redox reaction? Justify your answer with the change in oxidation states.\nMnO₂ + 4HCl → MnCl₂ + 2H₂O + Cl₂",
    modelAnswer:
      "Yes. Manganese is reduced from +4 in MnO₂ to +2 in MnCl₂, while chloride ion is oxidised from −1 in HCl to 0 in Cl₂. Oxidation and reduction happen together, so the reaction is a redox reaction.",
    markingPoints: [
      "Manganese is reduced (+4 to +2).",
      "Chloride is oxidised (−1 to 0).",
      "States that both occur together, so it is redox.",
    ],
    origin: "CBSE 2023 · 31/6/1 · Q21",
  },
  {
    chapter: "Acids, Bases and Salts",
    type: "mcq",
    marks: 1,
    prompt: "The acid present in tamarind is:",
    options: ["Citric acid", "Tartaric acid", "Lactic acid", "Oxalic acid"],
    answerIndex: 1,
    explanation:
      "Tamarind contains tartaric acid; citric acid is in citrus fruit, lactic acid in sour milk and oxalic acid in tomatoes and spinach.",
    origin: "CBSE 2025 · 31/6/1 · Q6",
  },
  {
    chapter: "Acids, Bases and Salts",
    type: "short",
    marks: 1,
    prompt: "Write the chemical formula of Plaster of Paris.",
    modelAnswer: "CaSO₄·½H₂O (calcium sulphate hemihydrate).",
    markingPoints: ["CaSO₄·½H₂O or 2CaSO₄·H₂O."],
    origin: "CBSE 2020 · 31/1/1 · Q8",
  },
  {
    chapter: "Metals and Non-metals",
    type: "mcq",
    marks: 1,
    prompt:
      "Which pair of metal oxides reacts with both acids and bases?",
    options: [
      "Na₂O and CaO",
      "ZnO and Al₂O₃",
      "CuO and FeO",
      "MgO and K₂O",
    ],
    answerIndex: 1,
    explanation:
      "Zinc oxide and aluminium oxide are amphoteric: they react with acids to form salts and with bases to form zincates and aluminates.",
    origin: "CBSE 2023 · 31/6/1 · Q1",
  },
  {
    chapter: "Metals and Non-metals",
    type: "short",
    marks: 3,
    prompt:
      "A heated copper sample is exposed to hydrogen gas. Describe the change you observe and write the balanced chemical equation for the reaction.",
    modelAnswer:
      "Copper(II) oxide is formed as a black coating when copper is heated in air. On passing hydrogen over the hot black copper(II) oxide, it is reduced back to reddish-brown copper and water vapour is formed: CuO + H₂ → Cu + H₂O.",
    markingPoints: [
      "Black copper(II) oxide changes to reddish-brown copper.",
      "Hydrogen acts as a reducing agent.",
      "Balanced equation CuO + H₂ → Cu + H₂O.",
    ],
    origin: "CBSE 2020 · 31/1/1 · Q15",
  },
  {
    chapter: "Life Processes",
    type: "short",
    marks: 3,
    prompt:
      "Name the enzyme secreted in the mouth and the gland that secretes it. What happens to the digestion of starch if this secretion stops?",
    modelAnswer:
      "Salivary amylase (ptyalin) is secreted by the salivary glands. It breaks starch down into maltose. If the secretion stops, starch is not digested in the mouth and reaches the stomach unchanged, where acid stops amylase action; digestion of starch then depends on pancreatic amylase in the small intestine, so the process is delayed and less complete.",
    markingPoints: [
      "Salivary amylase / ptyalin.",
      "Secreted by the salivary glands.",
      "Starch is not converted to maltose in the mouth; digestion is delayed.",
    ],
    origin: "CBSE 2023 · 31/6/1 · Q23",
  },
  {
    chapter: "Life Processes",
    type: "short",
    marks: 3,
    prompt:
      "Explain how oxygenated and deoxygenated blood circulate in a human being.",
    modelAnswer:
      "Blood passes through the heart twice in one complete circuit — double circulation. Deoxygenated blood from the body enters the right atrium, goes to the right ventricle and is pumped to the lungs, where it picks up oxygen (pulmonary circuit). Oxygenated blood returns to the left atrium, passes to the left ventricle and is pumped through the aorta to the body (systemic circuit). The four-chambered heart keeps the two streams separate, which allows efficient oxygen supply.",
    markingPoints: [
      "Pulmonary circuit: right side to lungs and back to left atrium.",
      "Systemic circuit: left ventricle to body and back to right atrium.",
      "Double circulation and separation of oxygenated and deoxygenated blood.",
    ],
    origin: "CBSE 2023 · 31/6/1 · Q27",
  },
  {
    chapter: "Life Processes",
    type: "short",
    marks: 1,
    prompt:
      "State the final products of digestion of proteins, carbohydrates and fats.",
    modelAnswer:
      "Proteins → amino acids; carbohydrates → glucose; fats → fatty acids and glycerol.",
    markingPoints: [
      "Amino acids",
      "Glucose",
      "Fatty acids and glycerol",
    ],
    origin: "CBSE 2024 · 31/4/1 · Q6",
  },
  {
    chapter: "The Human Eye and the Colourful World",
    type: "short",
    marks: 3,
    prompt: "State two causes of myopia and explain how it is corrected.",
    modelAnswer:
      "Myopia (short-sightedness) happens when the eyeball is elongated or the crystalline lens is too curved, so the image of a distant object forms in front of the retina. A concave lens of suitable power diverges the rays slightly before they enter the eye so the image falls on the retina.",
    markingPoints: [
      "Excessive curvature of the lens or elongation of the eyeball.",
      "Image of a distant object forms in front of the retina.",
      "Corrected with a concave lens of suitable power.",
    ],
    origin: "CBSE 2023 · 31/6/1 · Q31",
  },
  {
    chapter: "Heredity",
    type: "mcq",
    marks: 1,
    prompt:
      "A pure tall, round-seeded pea plant (TTRR) is crossed with a pure short, wrinkled-seeded plant (ttrr). The F₁ plants will be:",
    options: [
      "All tall with round seeds",
      "All short with wrinkled seeds",
      "Tall and short in a 3 : 1 ratio, all with round seeds",
      "All tall with wrinkled seeds",
    ],
    answerIndex: 0,
    explanation:
      "All F₁ plants are TtRr. Tall (T) and round (R) are dominant, so every plant is tall with round seeds.",
    origin: "CBSE 2025 · 31/6/1 · Q8",
  },
  {
    chapter: "Electricity",
    type: "short",
    marks: 1,
    prompt:
      "Calculate the heat produced in a 20 Ω resistor carrying a current of 5 A for 30 s.",
    modelAnswer: "H = I²Rt = 5² × 20 × 30 = 15,000 J.",
    markingPoints: ["Uses H = I²Rt.", "15,000 J / 1.5 × 10⁴ J."],
    origin: "CBSE 2024 · 31/4/1 · Q14",
  },
  {
    chapter: "Magnetic Effects of Electric Current",
    type: "short",
    marks: 1,
    prompt: "Name two sources of magnetic fields.",
    modelAnswer: "A bar magnet and a current-carrying coil (electromagnet).",
    markingPoints: ["Any two of: bar magnet, electromagnet, current-carrying wire."],
    origin: "CBSE 2020 · 31/1/1 · Q2",
  },
];

const MATHS: BankQuestion[] = [
  {
    chapter: "Real Numbers",
    type: "mcq",
    marks: 1,
    prompt: "How many factors does a prime number have?",
    options: ["One", "Two", "Three", "Depends on the prime"],
    answerIndex: 1,
    explanation:
      "Every prime has exactly two factors: 1 and the number itself.",
    origin: "CBSE 2020 · 30/1/1 · Q2",
  },
  {
    chapter: "Real Numbers",
    type: "short",
    marks: 1,
    prompt: "Find the HCF and LCM of 12, 21 and 15.",
    modelAnswer:
      "12 = 2² × 3, 21 = 3 × 7, 15 = 3 × 5. HCF = 3; LCM = 2² × 3 × 5 × 7 = 420.",
    markingPoints: ["HCF = 3", "LCM = 420"],
    origin: "CBSE 2020 · 30/1/1 · Q5",
  },
  {
    chapter: "Real Numbers",
    type: "short",
    marks: 1,
    prompt:
      "If the HCF of 65 and 104 is 13 and their LCM is 40x, find the value of x.",
    modelAnswer:
      "HCF × LCM = product of the numbers, so 13 × 40x = 65 × 104. That gives 520x = 6760, hence x = 13.",
    markingPoints: ["Uses HCF × LCM = product.", "x = 13."],
    origin: "CBSE 2024 · 30/4/1 · Q2",
  },
  {
    chapter: "Real Numbers",
    type: "mcq",
    marks: 1,
    prompt: "Which digit cannot be the units digit of 8ⁿ, where n is a natural number?",
    options: ["2", "4", "6", "0"],
    answerIndex: 3,
    explanation:
      "Powers of 8 end in 8, 4, 2, 6 and repeat — never in 0, because 8ⁿ is never a multiple of 10.",
    origin: "CBSE 2025 · 30/6/1 · Q2",
  },
  {
    chapter: "Polynomials",
    type: "short",
    marks: 1,
    prompt: "If 2 is a zero of the polynomial x² + 3x + k, find the value of k.",
    modelAnswer:
      "p(2) = 4 + 6 + k = 0, so k = −10.",
    markingPoints: ["Substitutes x = 2.", "k = −10."],
    origin: "CBSE 2020 · 30/1/1 · Q1",
  },
  {
    chapter: "Polynomials",
    type: "short",
    marks: 1,
    prompt: "For p(x) = x² − 5x + 6, find p(1) + p(4).",
    modelAnswer: "p(1) = 1 − 5 + 6 = 2 and p(4) = 16 − 20 + 6 = 2, so the sum is 4.",
    markingPoints: ["p(1) = 2", "p(4) = 2", "sum = 4"],
    origin: "CBSE 2024 · 30/4/1 · Q3",
  },
  {
    chapter: "Arithmetic Progressions",
    type: "short",
    marks: 2,
    prompt:
      "Show that (a − b)², a² + b² and (a + b)² are in an arithmetic progression.",
    modelAnswer:
      "The difference between the second and first term is a² + b² − (a − b)² = 2ab. The difference between the third and second is (a + b)² − (a² + b²) = 2ab. Both differences are equal, so the three terms are in A.P.",
    markingPoints: [
      "Second − first = 2ab.",
      "Third − second = 2ab.",
      "Common difference is the same, so the terms are in A.P.",
    ],
    origin: "CBSE 2020 · 30/1/1 · Q21",
  },
  {
    chapter: "Coordinate Geometry",
    type: "short",
    marks: 1,
    prompt: "Find the distance of the point A(−3, −4) from the x-axis.",
    modelAnswer: "The distance from the x-axis is |y| = 4 units.",
    markingPoints: ["4 units"],
    origin: "CBSE 2025 · 30/6/1 · Q5",
  },
  {
    chapter: "Some Applications of Trigonometry",
    type: "short",
    marks: 1,
    prompt:
      "The shadow of a tower on the ground is equal to its height. Find the altitude of the Sun.",
    modelAnswer:
      "tan θ = height / shadow = 1, so θ = 45°.",
    markingPoints: ["45°"],
    origin: "CBSE 2024 · 30/4/1 · Q14",
  },
  {
    chapter: "Areas Related to Circles",
    type: "short",
    marks: 1,
    prompt:
      "What fraction of a circle's circumference is an arc which subtends an angle of 90° at the centre?",
    modelAnswer: "(90 / 360) = 1/4 of the circumference.",
    markingPoints: ["1/4 (or 1 : 4)"],
    origin: "CBSE 2024 · 30/4/1 · Q5",
  },
  {
    chapter: "Areas Related to Circles",
    type: "short",
    marks: 1,
    prompt:
      "Find the central angle of a sector of a circle of radius 12 cm whose area is 60π cm².",
    modelAnswer:
      "Area of sector = (θ/360)πr², so 60π = (θ/360)π × 144. Then θ = 150°.",
    markingPoints: ["Uses the sector-area formula.", "θ = 150°."],
    origin: "CBSE 2024 · 30/4/1 · Q6",
  },
  {
    chapter: "Probability",
    type: "short",
    marks: 2,
    prompt:
      "Two dice are thrown together. Find the probability that both show odd numbers.",
    modelAnswer:
      "The sample space has 36 outcomes. Odd numbers on both dice give 3 × 3 = 9 favourable outcomes, so P = 9/36 = 1/4.",
    markingPoints: ["36 total outcomes.", "9 favourable outcomes.", "P = 1/4."],
    origin: "CBSE 2024 · 30/4/1 · Q8",
  },
  {
    chapter: "Probability",
    type: "short",
    marks: 1,
    prompt:
      "A letter is chosen at random from the English alphabet. Find the probability that it is a consonant.",
    modelAnswer: "There are 21 consonants in 26 letters, so P = 21/26.",
    markingPoints: ["21/26"],
    origin: "CBSE 2020 · 30/1/1 · Q18",
  },
  {
    chapter: "Real Numbers",
    type: "mcq",
    marks: 1,
    prompt: "√0.4 is:",
    options: ["A rational number", "An irrational number", "An integer", "A whole number"],
    answerIndex: 1,
    explanation:
      "√0.4 = 2/√10, and √10 is irrational, so √0.4 is irrational too.",
    origin: "CBSE 2025 · 30/6/1 · Q1",
  },
];

const SOCIAL_SCIENCE: BankQuestion[] = [
  {
    chapter: "History · The Rise of Nationalism in Europe",
    type: "mcq",
    marks: 1,
    prompt:
      "Which revolution is described as the first expression of nationalism?",
    options: [
      "The American Revolution",
      "The French Revolution",
      "The Industrial Revolution",
      "The Russian Revolution",
    ],
    answerIndex: 1,
    explanation:
      "The French Revolution of 1789 produced the first clear expression of nationalism, transferring sovereignty from the monarchy to a body of citizens.",
    origin: "CBSE 2020 · 32/1/1 · Q1",
  },
  {
    chapter: "History · The Rise of Nationalism in Europe",
    type: "mcq",
    marks: 1,
    prompt: "Which region joined the unified Italian state in 1866?",
    options: ["Lombardy", "Venetia", "Rome", "Sardinia"],
    answerIndex: 1,
    explanation:
      "Venetia was integrated in 1866; Rome joined in 1870, completing unification.",
    origin: "CBSE 2025 · 32/1/1 · Q1",
  },
  {
    chapter: "History · The Rise of Nationalism in Europe",
    type: "short",
    marks: 2,
    prompt:
      "How did the Treaty of Constantinople of 1832 recognise Greece?",
    modelAnswer:
      "The treaty recognised Greece as an independent nation, ending centuries of Ottoman rule. Greece had been part of the Ottoman Empire and its struggle for independence drew support from educated Greeks and philhellenes across Europe, whose culture and literature rallied Western sympathy.",
    markingPoints: [
      "Recognised Greece as an independent nation.",
      "Ended Ottoman control.",
      "Growing European sympathy for the Greek cause.",
    ],
    origin: "CBSE 2023 · 32/6/1 · Q21",
  },
  {
    chapter: "History · The Rise of Nationalism in Europe",
    type: "long",
    marks: 5,
    prompt:
      "Analyse the significance of the Napoleonic Code in the administration of Europe.",
    modelAnswer:
      "The Civil Code of 1804, known as the Napoleonic Code, abolished all privileges based on birth, established equality before the law and secured the right to property. It simplified administrative divisions, abolished the feudal system and freed peasants from serfdom and manorial dues, and it removed guild restrictions in towns so trade and transport could grow. Uniform laws, standardised weights and measures and a common currency made commerce easier for both merchants and small producers. Its limits matter too: the Code was carried abroad by French armies, so the reforms were imposed rather than chosen, and it never extended to the political rights of ordinary citizens or to women.",
    markingPoints: [
      "Abolished privileges by birth and established equality before law.",
      "Right to property and simplified administration.",
      "Abolished feudalism, freed peasants from serfdom and manorial dues.",
      "Uniform laws, weights, measures and currency helped trade.",
      "Limits: imposed by conquest, and political rights excluded.",
    ],
    origin: "CBSE 2025 · 32/1/1 · Q30",
  },
  {
    chapter: "History · Nationalism in India",
    type: "short",
    marks: 3,
    prompt:
      "Explain the decision of the Justice Party to enter the council elections in Madras during the Non-Cooperation Movement, and the economic effects of the movement's boycott of foreign goods.",
    modelAnswer:
      "In Madras, the non-Brahmin Justice Party did not boycott the council elections because it saw the councils as a way to gain political representation it had been denied in a society dominated by Brahmins. Economically, the boycott of foreign cloth and goods caused imports of foreign textiles to fall sharply, British mill production dropped and Indian mills gained business. The price of foreign cloth also fell as traders holding stocks had to sell them off, while picketing and the burning of imported cloth pushed consumers toward hand-woven khadi.",
    markingPoints: [
      "Justice Party entered councils to gain representation for non-Brahmins.",
      "Imports of foreign cloth fell sharply.",
      "Indian mills and khadi gained; foreign cloth stocks were sold cheaply.",
    ],
    origin: "CBSE 2020 · 32/1/1 · Q21",
  },
  {
    chapter: "History · Nationalism in India",
    type: "short",
    marks: 3,
    prompt: "State three causes of the Non-Cooperation Movement.",
    modelAnswer:
      "The Rowlatt Act of 1919, which allowed detention without trial, and the Jallianwala Bagh massacre made cooperation with the colonial state impossible. Gandhi also linked the Khilafat issue, the fear that the Ottoman Caliph's authority would be dismantled after the First World War, to the movement to bring Hindus and Muslims together. Rising prices and the burden of colonial taxes, together with the government's refusal to address peasant distress, widened the base of the movement.",
    markingPoints: [
      "Rowlatt Act and Jallianwala Bagh.",
      "Khilafat issue.",
      "Economic distress and rural grievance.",
    ],
    origin: "CBSE 2024 · 32/1/1 · Q25",
  },
  {
    chapter: "History · Nationalism in India",
    type: "short",
    marks: 3,
    prompt:
      "How did tribal peasants interpret Gandhi and the idea of Swaraj?",
    modelAnswer:
      "For tribal peasants in the Gudem hills of Andhra Pradesh, Swaraj meant the restoration of traditional rights to graze cattle and collect wood and fruit from the forest, which the colonial Forest Acts had taken away. Their leader Alluri Sitaram Raju spoke of the greatness of Gandhi and asked people to wear khadi and give up drinking, but he also told them that India could be liberated only by force. When the police forced them out of the forests and attacked them, the peasants saw in Gandhi's name a justification for refusing tribute and opposing the forest laws.",
    markingPoints: [
      "Swaraj meant restoration of forest rights and grazing access.",
      "Alluri Sitaram Raju linked Gandhi's name to their grievances.",
      "Mixed armed resistance with Gandhian methods.",
    ],
    origin: "CBSE 2025 · 32/1/1 · Q25",
  },
  {
    chapter: "History · The Making of a Global World",
    type: "short",
    marks: 2,
    prompt:
      "Give two examples of trade or cultural exchange associated with the Silk Route.",
    modelAnswer:
      "Chinese silk travelled westward in return for precious metals, and the route also carried Indian spices and textiles. Alongside goods, religions moved: Buddhism spread from India to China and other parts of Asia through the same network, and with it came art, architectural styles and the exchange of ideas.",
    markingPoints: [
      "A traded good, e.g. Chinese silk, Indian spices or textiles.",
      "A cultural exchange, e.g. the spread of Buddhism or art styles.",
    ],
    origin: "CBSE 2024 · 32/1/1 · Q21",
  },
  {
    chapter: "History · Print Culture and the Modern World",
    type: "short",
    marks: 1,
    prompt: "Why was the Vernacular Press Act introduced in 1878?",
    modelAnswer:
      "To control and censor vernacular newspapers which were criticising government policies and building nationalist public opinion after the events of 1857.",
    markingPoints: [
      "To censor vernacular newspapers.",
      "Because they criticised the government and spread nationalist ideas.",
    ],
    origin: "CBSE 2020 · 32/1/1 · Q3",
  },
  {
    chapter: "History · Print Culture and the Modern World",
    type: "short",
    marks: 3,
    prompt:
      "State three effects of print culture on the French Revolution.",
    modelAnswer:
      "Print carried the ideas of Enlightenment thinkers such as Voltaire and Rousseau to a wide reading public and made them part of everyday debate. Newspapers, pamphlets and cartoons attacked the monarchy and the privileges of the nobility and the Church, shaping a public opinion that was hostile to the old order. Cheap printed material also reached artisans and peasants, giving them a language for their grievances, while the reading public was itself created by the spread of print.",
    markingPoints: [
      "Spread Enlightenment ideas to a wider public.",
      "Criticised monarchy, nobility and the Church.",
      "Created a public opinion and a reading public outside the elite.",
    ],
    origin: "CBSE 2023 · 32/6/1 · Q25",
  },
  {
    chapter: "Geography · Agriculture",
    type: "mcq",
    marks: 1,
    prompt:
      "Which staple kharif crop requires high temperature, high humidity and more than 100 cm of rainfall?",
    options: ["Wheat", "Rice", "Mustard", "Gram"],
    answerIndex: 1,
    explanation:
      "Rice is a kharif crop that needs high temperature, high humidity and rainfall above 100 cm; in drier areas it is grown with irrigation.",
    origin: "CBSE 2023 · 32/6/1 · Q5",
  },
  {
    chapter: "History · Nationalism in India",
    type: "short",
    marks: 2,
    prompt:
      "Explain the role of the anti-colonial struggle in the rise of modern Indian nationalism.",
    modelAnswer:
      "A shared enemy gave people across regions, languages and religions a common cause. Resistance to colonial policies, from the revolt of 1857 to the Rowlatt Act and the Non-Cooperation Movement, produced joint action, common symbols such as Swaraj and khadi, and a sense that Indians had a collective identity and a right to self-rule.",
    markingPoints: [
      "Common opposition to colonial rule created shared identity.",
      "Mass participation and shared symbols of struggle.",
      "Turned local grievances into a national movement.",
    ],
    origin: "CBSE 2025 · 32/1/1 · Q21",
  },
];

const BANK: Record<string, BankQuestion[]> = {
  "10:science": SCIENCE,
  "10:maths": MATHS,
  "10:social-science": SOCIAL_SCIENCE,
};

/** Every real board question available for a class + subject. */
export function boardBank(classId: string, subjectId: string): BankQuestion[] {
  return BANK[`${classId}:${subjectId}`] ?? [];
}

/** The chapters that actually have a past-paper question behind them. */
export function bankChapters(classId: string, subjectId: string): string[] {
  return [...new Set(boardBank(classId, subjectId).map((item) => item.chapter))];
}

export function hasBoardQuestions(
  classId: string,
  subjectId: string,
  chapters: string[],
): boolean {
  if (chapters.length === 0) return boardBank(classId, subjectId).length > 0;
  const picked = new Set(chapters);
  return boardBank(classId, subjectId).some((item) => picked.has(item.chapter));
}
