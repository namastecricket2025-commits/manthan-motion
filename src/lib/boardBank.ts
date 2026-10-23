/**
 * Real CBSE Class 10 board questions, by chapter.
 *
 * The mock exam has always been able to imitate a board paper; this file is
 * the part that does not imitate. Each entry is a question from a CBSE Class 10
 * board paper between 2020 and 2025, tagged with its paper code so the student
 * can check it against the original. When Class 10 sits a "Board simulation",
 * these are used first and the model writes the rest of the paper.
 *
 * Coverage spans all six Class 10 subjects: Science, Mathematics (Standard),
 * Social Science, English (Language and Literature), Hindi (Course B) and
 * Information Technology (402). A chapter with no entry is not fabricated —
 * the setter writes a fresh question in the board's pattern instead.
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

/*
 * English (Language and Literature, 2/x/x). The 2023–2025 pages reproduce
 * these literature questions by year but do not print the paper set beside
 * each item, so `origin` names the year and the paper rather than inventing a
 * set code.
 */
const ENGLISH: BankQuestion[] = [
  {
    chapter: "Prose · Two Stories about Flying",
    type: "short",
    marks: 3,
    prompt:
      "The young seagull's fear of flying and reluctance to leave his ledge contribute to the development of the theme of independence and courage in the story. Justify.",
    modelAnswer:
      "The seagull's fear keeps him frozen on the ledge, calling out to his family while they fly and feed themselves. Hunger finally overcomes that fear, and the moment he drops and finds his wings holding him, the story shows that courage is not the absence of fear but action taken in spite of it. His independence begins only when he stops waiting to be fed and trusts himself.",
    markingPoints: [
      "Fear and reluctance are shown through his refusal to leave the ledge.",
      "Hunger forces the first act of courage.",
      "Flight brings independence and confidence, which is the theme.",
    ],
    origin: "CBSE 2025 · English · literature",
  },
  {
    chapter: "Prose · Two Stories about Flying",
    type: "short",
    marks: 3,
    prompt:
      "Briefly bring out the contrast between the young seagull's initial attempts to fly and his first successful flight.",
    modelAnswer:
      "At first he merely flaps his wings on the ledge and runs to its brink, then draws back out of fear, so his attempts end in hesitation rather than flight. In his first real flight he drops into the air, feels the wind under his wings, and is soon soaring, diving at the sea and catching fish with his brothers and sister. The contrast is between timid, unfinished movement and joyful, confident flight.",
    markingPoints: [
      "Initial attempts: flapping, running to the edge, drawing back in fear.",
      "First flight: drops, wings hold him, he soars and dives.",
      "Contrast in confidence and outcome.",
    ],
    origin: "CBSE 2024 · English · literature",
  },
  {
    chapter: "Prose · Two Stories about Flying",
    type: "short",
    marks: 3,
    prompt:
      "Flying is a natural act in birds. Then why was the young seagull 'exhausted by the strange exercise'? Justify the given statement with reference to the baby seagull's fear.",
    modelAnswer:
      "Although flight comes naturally to birds, the seagull had never used his wings before, so the first flight demanded effort and nerve he had not built up. His fear had kept him on the ledge for a long time, and the sudden plunge, the beating of wings and the unfamiliar control of wind and balance tired him. The exercise was strange because it was new, not because it was unnatural.",
    markingPoints: [
      "He had never flown before, so the first effort was unfamiliar.",
      "Fear had kept him inactive and unprepared.",
      "The physical effort of the first flight left him exhausted.",
    ],
    origin: "CBSE 2024 · English · literature",
  },
  {
    chapter: "Prose · Two Stories about Flying",
    type: "short",
    marks: 3,
    prompt:
      "'Family played a vital role in the first flight of the young seagull.' Give examples to substantiate the above statement.",
    modelAnswer:
      "His parents encouraged him to fly and then deliberately withheld food, so hunger pushed him off the ledge. His mother flew close with a piece of fish and stopped just out of reach, tempting him into the air, and his brothers and sister had already flown, showing him what was possible. Their teasing and their example made him attempt the flight.",
    markingPoints: [
      "Parents urged him and withheld food.",
      "Mother tempted him with fish just out of reach.",
      "Siblings had already flown and set an example.",
    ],
    origin: "CBSE 2023 · English · literature",
  },
  {
    chapter: "Prose · Two Stories about Flying",
    type: "long",
    marks: 6,
    prompt:
      "You have been asked to present an evaluation of the approaches of both the baby seagull and the pilot who was lost in the clouds towards achieving their dreams of conquering the skies. Write this presentation draft including your insights, comparing the approaches of both.",
    modelAnswer:
      "Both the seagull and the pilot want the same thing — to fly — but they reach it by opposite routes. The seagull begins in fear, clinging to his ledge and refusing to try until hunger and his family's encouragement push him into the air; his courage is forced on him, and once he drops he discovers that the sky will hold him. The pilot, by contrast, sets out confidently, but when clouds close in and his compass and radio fail, he is saved by trusting a fellow pilot who guides him down. The seagull's lesson is that fear has to be met with action; the pilot's is that confidence is not self-sufficiency, and that accepting help is part of skill. In both stories the dream is achieved when the flier stops relying only on himself.",
    markingPoints: [
      "Both aim to fly but start from different attitudes.",
      "Seagull: fear, hunger, family encouragement, first flight.",
      "Pilot: confidence, lost instruments, guided by another pilot.",
      "Insight: courage may need a push; skill may need help.",
      "Comparison drawn explicitly, in a presentation tone.",
    ],
    origin: "CBSE 2024 · English · literature",
  },
  {
    chapter: "Prose · Two Stories about Flying",
    type: "long",
    marks: 6,
    prompt:
      "Motivation plays an important role in taking risks in life and in succeeding. Do you agree? Discuss with reference to the pilot of the old Dakota and the young seagull.",
    modelAnswer:
      "Yes — in both stories the risk is taken because something makes it worth taking. The seagull's motivation is hunger and the example of his family; once he drops from the ledge, that motivation carries him through the frightening first moments into flight. The pilot's motivation is to reach home and, when his instruments fail, to trust the voice guiding him; his desire to land safely keeps him steady enough to follow instructions. Motivation does not remove the danger, but it makes the danger bearable and the effort possible.",
    markingPoints: [
      "Agrees that motivation drives risk-taking.",
      "Seagull: hunger and family example lead him to fly.",
      "Pilot: wanting to reach home and trusting guidance.",
      "Concludes that motivation makes risk bearable and success possible.",
    ],
    origin: "CBSE 2023 · English · literature",
  },
  {
    chapter: "Prose · From the Diary of Anne Frank",
    type: "mcq",
    marks: 1,
    prompt: "The first education of Anne started at:",
    options: [
      "Some Kindergarten School",
      "A Nursery School",
      "Montessori Nursery School",
      "Elementary School",
    ],
    answerIndex: 2,
    explanation:
      "Anne says she was sent to the Montessori nursery school at the age of six and stayed there until she was eleven, before moving to the Jewish Lyceum.",
    origin: "CBSE 2024 · English · answer key",
  },
  {
    chapter: "Prose · Nelson Mandela: Long Walk to Freedom",
    type: "mcq",
    marks: 1,
    prompt: "The system of racial domination has been replaced by a system that:",
    options: [
      "confirms the education of the Blacks",
      "recognises the rights and freedoms of all people",
      "recollects the bitter experiences",
      "focuses on personality development",
    ],
    answerIndex: 1,
    explanation:
      "Mandela says the apartheid system has been replaced by one that recognises the rights and freedoms of all people, regardless of the colour of their skin.",
    origin: "CBSE 2024 · English · answer key",
  },
];

/* Mathematics (Standard, 30/x/x) — chapter gaps the 2020–2025 bank left. */
const MATHS_MORE: BankQuestion[] = [
  {
    chapter: "Quadratic Equations",
    type: "mcq",
    marks: 1,
    prompt:
      "If the roots of ax² + bx + c = 0, a ≠ 0, are real and equal, which relation is true?",
    options: ["a = b²/c", "b² = ac", "ac = b²/4", "c = b²/a"],
    answerIndex: 2,
    explanation:
      "Equal real roots need the discriminant b² − 4ac = 0, which rearranges to ac = b²/4.",
    origin: "CBSE 2024 · 30/1/2 · Q11",
  },
  {
    chapter: "Triangles",
    type: "short",
    marks: 2,
    prompt:
      "Diagonals AC and BD of a trapezium ABCD, with AB ∥ DC, intersect at O. If DO/OB = 1/2, show that AB = 2CD.",
    modelAnswer:
      "In triangles AOB and COD, ∠AOB = ∠COD (vertically opposite angles) and ∠OAB = ∠OCD (alternate angles, AB ∥ DC). So ΔAOB ~ ΔCOD by AA similarity, giving AB/CD = OB/DO. Since DO/OB = 1/2, OB/DO = 2, hence AB/CD = 2 and AB = 2CD.",
    markingPoints: [
      "∠AOB = ∠COD and ∠OAB = ∠OCD, so ΔAOB ~ ΔCOD.",
      "AB/CD = OB/DO = 2.",
      "Hence AB = 2CD.",
    ],
    origin: "CBSE 2024 · 30/1/2 · Q21",
  },
  {
    chapter: "Statistics",
    type: "mcq",
    marks: 1,
    prompt:
      "For data x₁, x₂, …, xₙ with frequencies f₁, f₂, …, fₙ, the value of Σfᵢ(xᵢ − x̄) is:",
    options: ["n x̄", "1", "Σfᵢ", "0"],
    answerIndex: 3,
    explanation:
      "The deviations of values from the mean cancel out when weighted by their frequencies, so Σfᵢ(xᵢ − x̄) = 0.",
    origin: "CBSE 2024 · 30/1/2 · Q14",
  },
  {
    chapter: "Circles",
    type: "mcq",
    marks: 1,
    prompt:
      "For a circle with centre O and radius 5 cm, which of these statements is true?",
    options: [
      "P: The distance between every pair of parallel tangents is 5 cm.",
      "Q: The distance between every pair of parallel tangents is 10 cm.",
      "R: It must be between 5 cm and 10 cm.",
      "S: There is no point outside the circle from which a tangent of length 5 cm can be drawn.",
    ],
    answerIndex: 1,
    explanation:
      "Parallel tangents touch the circle at opposite ends of a diameter, so the distance between them is 2 × 5 = 10 cm.",
    origin: "CBSE 2025 · 30/6/1 · Q10",
  },
  {
    chapter: "Surface Areas and Volumes",
    type: "mcq",
    marks: 1,
    prompt:
      "A cone of the greatest possible volume is hollowed out from a solid wooden cylinder. What is the ratio of the volume of the remaining wood to the volume of the cone hollowed out?",
    options: ["1 : 1", "1 : 3", "2 : 1", "3 : 1"],
    answerIndex: 2,
    explanation:
      "Cone: (1/3)πr²h. Remaining wood: πr²h − (1/3)πr²h = (2/3)πr²h. The ratio is 2 : 1.",
    origin: "CBSE 2025 · 30/6/1 · Q14",
  },
  {
    chapter: "Introduction to Trigonometry",
    type: "mcq",
    marks: 1,
    prompt:
      "In right triangle ABC, right-angled at A, if sin B = 1/4, then sec B equals:",
    options: ["4", "√15/4", "√15", "4/√15"],
    answerIndex: 3,
    explanation:
      "cos B = √(1 − sin²B) = √(15/16) = √15/4, so sec B = 4/√15.",
    origin: "CBSE 2025 · 30/6/1 · trigonometry",
  },
];

/* Social Science — Civics and Economics, the two sections the bank lacked. */
const SOCIAL_SCIENCE_MORE: BankQuestion[] = [
  {
    chapter: "Civics · Power-sharing",
    type: "short",
    marks: 2,
    prompt: "Why is power sharing desirable?",
    modelAnswer:
      "Power sharing reduces the chance of conflict between social groups by giving each a stake in how they are governed, and it prevents one group from imposing its will on the rest. It also makes government more responsive and stable, because decisions are taken with the consent of those affected.",
    markingPoints: [
      "Reduces conflict and the possibility of majority domination.",
      "Gives groups a stake and makes government stable and responsive.",
    ],
    origin: "CBSE 2024 · 32/1/1 · social science",
  },
  {
    chapter: "Economics · Money and Credit",
    type: "short",
    marks: 3,
    prompt: "How is credit essential for economic activities? Explain with examples.",
    modelAnswer:
      "Credit lets producers start or expand work before they have the money from sales. A farmer borrows for seeds, fertiliser and irrigation and repays after harvest, so credit raises output and income. A small manufacturer borrows for raw material and wages during the production cycle, and a shopkeeper uses credit to stock goods before the selling season. Without credit, most of these activities would have to stay small or wait for savings to accumulate.",
    markingPoints: [
      "Credit finances inputs before returns arrive.",
      "Farmer example: seeds, fertiliser, irrigation, repaid after harvest.",
      "Business example: working capital, stock, expansion.",
      "Raises production, income and employment.",
    ],
    origin: "CBSE 2024 · 32/1/1 · social science",
  },
  {
    chapter: "Economics · Money and Credit",
    type: "mcq",
    marks: 1,
    prompt:
      "Why does it become difficult for farmers in rural areas to take loans from formal banks?",
    options: [
      "They have no identity documents.",
      "They cannot offer collateral as security.",
      "Banks are not allowed to lend to farmers.",
      "Formal loans carry no interest.",
    ],
    answerIndex: 1,
    explanation:
      "Formal lenders demand collateral such as land or a deposit. Many small farmers lack clear title or enough assets, so they turn to moneylenders at high interest.",
    origin: "CBSE 2025 · 32/1/1 · economics",
  },
];

/* Hindi (Course B, 4/x/x) — literature questions, transcribed from the papers. */
const HINDI: BankQuestion[] = [
  {
    chapter: "कबीर की साखियाँ",
    type: "short",
    marks: 2,
    prompt:
      "तन और वस्त्रों की स्वच्छता तो साबुन-पानी से की जा सकती है, स्वभाव को किस प्रकार स्वच्छ किया जा सकता है? कबीर की साखी के संदर्भ में लिखिए।",
    modelAnswer:
      "कबीर कहते हैं कि बाहरी स्वच्छता केवल पानी से होती है, पर मन की मैल को हरि-भक्ति और सत्संग से धोना पड़ता है। जब मन में क्रोध, लोभ और द्वेष नहीं रहते और जीव सबको समान मानता है, तब स्वभाव स्वच्छ होता है।",
    markingPoints: [
      "बाहरी स्वच्छता पानी से, भीतरी स्वच्छता साधना से।",
      "हरि-भक्ति, सत्संग और सदाचार से स्वभाव शुद्ध होता है।",
      "क्रोध, लोभ और द्वेष का त्याग।",
    ],
    origin: "CBSE 2025 · 4/1/2 · साहित्य",
  },
  {
    chapter: "मीरा के पद",
    type: "short",
    marks: 2,
    prompt:
      "श्रीकृष्ण की चाकरी करने के पीछे मीराबाई की क्या अभिलाषा थी?",
    modelAnswer:
      "मीराबाई चाकरी द्वारा कृष्ण के निकट रहकर उनका सान्निध्य पाना चाहती हैं। उनकी अभिलाषा संसार की सुख-सुविधा नहीं, बल्कि गिरधर नागर के चरणों में रहकर भवसागर पार उतरना है।",
    markingPoints: [
      "कृष्ण के निकट रहने की अभिलाषा।",
      "चरण-सेवा और सान्निध्य से भवसागर पार उतरना।",
      "सांसारिक सुखों की उपेक्षा।",
    ],
    origin: "CBSE 2025 · 4/1/2 · साहित्य",
  },
  {
    chapter: "मीरा के पद",
    type: "short",
    marks: 3,
    prompt:
      "मीरा अपने आराध्य कृष्ण से क्या विनती करती हैं और उन्हें उनके कर्तव्य का स्मरण करवाने के लिए क्या करती हैं?",
    modelAnswer:
      "मीरा कृष्ण से विनती करती हैं कि वे उन्हें अपना दासी बना लें और सदा अपने निकट रखें। वे उनके कर्तव्य का स्मरण कराने के लिए कहती हैं कि दीन-दुखियों की रक्षा करना उनका काम है — जब कोई शरण में आए तो उसे लज्जित न लौटाएँ — और वे स्वयं को उनकी शरण में बताकर उन्हें पुकारती हैं।",
    markingPoints: [
      "कृष्ण को दासी बनाने की विनती।",
      "दीन-दुखियों की रक्षा के कर्तव्य का स्मरण।",
      "शरणागत को लज्जित न लौटाने की पुकार।",
    ],
    origin: "CBSE 2024 · 4/1/3 · साहित्य",
  },
  {
    chapter: "संचयन · हरिहर काका",
    type: "short",
    marks: 3,
    prompt:
      "आपके पड़ोसी काका की स्थिति हरिहर काका से मिलती-जुलती है। आप उन्हें कैसे समझाएँगे और मदद करेंगे?",
    modelAnswer:
      "मैं उन्हें स्नेह से समझाऊँगा कि जो लोग ज़मीन के लालच में उनकी सेवा का ढोंग रचते हैं, उनसे सावधान रहें। उन्हें अपनी संपत्ति का कागज़ी हिस्सा अपने नाम पर सुरक्षित रखने, हस्ताक्षर करने से पहले सलाह लेने और किसी एक पुत्र के भरोसे पूरी ज़मीन न देने की सलाह दूँगा। साथ ही मैं स्वयं उनके पास आता-जाता रहूँगा, उनके भोजन और दवा का ध्यान रखूँगा और गाँव के भरोसेमंद लोगों को इस बात में शामिल करूँगा।",
    markingPoints: [
      "लालची रिश्तेदारों के व्यवहार को समझाना।",
      "संपत्ति और हस्ताक्षर को लेकर सतर्क करना।",
      "नियमित देखभाल, भोजन-दवा और भरोसेमंद लोगों की मदद।",
    ],
    origin: "CBSE 2024 · 4/1/3 · साहित्य",
  },
  {
    chapter: "मनुष्यता — मैथिलीशरण गुप्त",
    type: "short",
    marks: 3,
    prompt:
      "'घटे न हेलमेल हाँ, बढ़े न भिन्नता कभी' — 'मनुष्यता' कविता से ली गई इस पंक्ति के माध्यम से कवि ने जीवन रूपी मार्ग पर आगे बढ़ते समय क्या याद रखने को कहा है और क्यों?",
    modelAnswer:
      "कवि कहते हैं कि मनुष्यों में आपसी प्रेम और मेल-जोल कभी कम नहीं होना चाहिए और भेदभाव कभी नहीं बढ़ना चाहिए। जब सब लोग एक-दूसरे के साथ समानता और सहयोग से रहते हैं, तब समाज आगे बढ़ता है; भेदभाव विसंगति और कलह को जन्म देता है। इसलिए मानवता का मार्ग एकता और सद्भाव का मार्ग है।",
    markingPoints: [
      "आपसी प्रेम और सहयोग बना रहे, भेदभाव न बढ़े।",
      "मेल-जोल से समाज आगे बढ़ता है।",
      "भेदभाव से कलह और विसंगति फैलती है।",
    ],
    origin: "CBSE 2023 · 4/4/1 · साहित्य",
  },
  {
    chapter: "पर्वत प्रदेश में पावस — सुमित्रानंदन पंत",
    type: "mcq",
    marks: 1,
    prompt:
      "'पर्वत प्रदेश में पावस' कविता के आधार पर बताइए कि पर्वतों की ऊँचाई से गिरने वाले झरने किसके यश का गुणगान कर रहे हैं?",
    options: [
      "धरती के शिव की",
      "पर्वत के शिखर की",
      "मेघों के बरसते जल का",
      "वर्षा ऋतु की शोभा का",
    ],
    answerIndex: 0,
    explanation:
      "कविता में ऊँची पर्वत-चोटी से झरते जल के प्रवाह को 'शिव' के यश का गीत गाते हुए चित्रित किया गया है।",
    origin: "CBSE 2023 · 4/6/1 · साहित्य",
  },
];

/* Information Technology (402) — 2023–2025 board papers. */
const IT: BankQuestion[] = [
  {
    chapter: "Digital Documentation (Advanced)",
    type: "mcq",
    marks: 1,
    prompt:
      "How many levels of headings does OpenOffice Writer evaluate to build the Table of Contents?",
    options: ["6", "8", "10", "12"],
    answerIndex: 2,
    explanation:
      "Writer's Table of Contents dialog evaluates up to 10 heading levels, though most documents use the first two or three.",
    origin: "CBSE 2023 · IT 402",
  },
  {
    chapter: "Electronic Spreadsheets (Advanced)",
    type: "mcq",
    marks: 1,
    prompt: "Which feature of Calc is used to test 'what-if' questions?",
    options: ["Goal Seek", "Scenarios", "Subtotals", "Data Pilot"],
    answerIndex: 1,
    explanation:
      "Scenarios store alternative sets of input values so the effect of different assumptions can be compared without rewriting the sheet.",
    origin: "CBSE 2023 · IT 402",
  },
  {
    chapter: "Employability Skills",
    type: "short",
    marks: 2,
    prompt: "What is self-awareness? Also, give any two benefits of self-awareness.",
    modelAnswer:
      "Self-awareness is the ability to recognise one's own thoughts, feelings, strengths, weaknesses, beliefs and values, and to see how they affect behaviour. Two benefits: it helps a person set realistic goals and improve, and it makes communication and teamwork better because one understands one's own reactions.",
    markingPoints: [
      "Recognising one's own feelings, strengths and weaknesses.",
      "Benefit: realistic goals and self-improvement.",
      "Benefit: better relationships and communication.",
    ],
    origin: "CBSE 2023 · IT 402",
  },
  {
    chapter: "Database Management System",
    type: "short",
    marks: 2,
    prompt: "Give any two benefits of creating relationships between tables in a database.",
    modelAnswer:
      "Relationships avoid storing the same data in several places, so the data stays consistent when it is edited. They also let information from two tables be combined in a query or form, which makes reports and lookups possible and reduces typing errors.",
    markingPoints: [
      "Avoids duplication and keeps data consistent.",
      "Allows combined queries, forms and reports.",
    ],
    origin: "CBSE 2024 · IT 402",
  },
  {
    chapter: "Web Applications and Web Security",
    type: "mcq",
    marks: 1,
    prompt:
      "________ are text files with small pieces of data, like a username and password.",
    options: ["Cookies", "Macros", "Plug-ins", "Digital certificates"],
    answerIndex: 0,
    explanation:
      "Cookies are small text files a website stores on the browser to remember information such as a login or a preference.",
    origin: "CBSE 2024 · IT 402",
  },
  {
    chapter: "Electronic Spreadsheets (Advanced)",
    type: "short",
    marks: 2,
    prompt:
      "What is a Macro? Give any two rules that should be followed while naming a Macro or module in Calc.",
    modelAnswer:
      "A macro is a saved set of commands that can be run with one action, used to repeat a task automatically. Naming rules: begin the name with a letter, not a digit or punctuation; use only letters, digits and underscores, with no spaces; and avoid names that match a cell reference such as A1.",
    markingPoints: [
      "Macro: recorded or written set of commands that automates a task.",
      "Name begins with a letter; no spaces.",
      "Avoid names that look like cell references.",
    ],
    origin: "CBSE 2025 · IT 402",
  },
];

const BANK: Record<string, BankQuestion[]> = {
  "10:science": SCIENCE,
  "10:maths": [...MATHS, ...MATHS_MORE],
  "10:social-science": [...SOCIAL_SCIENCE, ...SOCIAL_SCIENCE_MORE],
  "10:english": ENGLISH,
  "10:hindi": HINDI,
  "10:computer": IT,
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
