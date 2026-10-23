/**
 * The school syllabus behind the mock exam.
 *
 * Until now a paper could only come from a notebook the student had built
 * themselves, which meant an empty account could not sit a single test. This
 * file is the other half: the CBSE / NCERT chapter lists for Classes 8, 9 and
 * 10, and the arithmetic that decides how big a paper should be for a given
 * clock.
 *
 * Chapter names follow the rationalised NCERT textbooks for the 2025–26
 * session (Classes 9 and 10) and the widely taught NCERT course for Class 8,
 * which has no board examination and varies from school to school. Social
 * Science and English are prefixed with their book or strand ("History ·
 * Nationalism in India", "Poem · Dust of Snow") so a chapter is unambiguous in
 * a dropdown and in a prompt.
 *
 * Sources: cbseacademic.nic.in (Secondary Curriculum 2025–26) and the NCERT
 * textbook contents pages for Classes 8–10.
 */

export type ClassId = "8" | "9" | "10";

export type SubjectId =
  | "science"
  | "maths"
  | "social-science"
  | "english"
  | "hindi"
  | "computer"
  | "ai";

export type ExamPattern = "objective" | "board";

/**
 * What kind of paper the student asked for.
 *
 * `practice` is a normal test over the chosen chapters. `board` is a board
 * simulation: for Class 10 it draws on real CBSE past-paper questions where the
 * bank has them for the selected chapters, and fills the rest with questions
 * written to the same pattern.
 */
export type PaperKind = "practice" | "board";

export interface Subject {
  id: SubjectId;
  name: string;
  chapters: string[];
}

export interface ClassSyllabus {
  id: ClassId;
  label: string;
  /** Shown under the class picker — what this class's papers are modelled on. */
  note: string;
  hasBoard: boolean;
  subjects: Subject[];
}

const CLASS_8_SCIENCE = [
  "Crop Production and Management",
  "Microorganisms: Friend and Foe",
  "Synthetic Fibres and Plastics",
  "Materials: Metals and Non-metals",
  "Coal and Petroleum",
  "Combustion and Flame",
  "Conservation of Plants and Animals",
  "Cell — Structure and Functions",
  "Reproduction in Animals",
  "Reaching the Age of Adolescence",
  "Force and Pressure",
  "Friction",
  "Sound",
  "Chemical Effects of Electric Current",
  "Some Natural Phenomena",
  "Light",
  "Stars and the Solar System",
  "Pollution of Air and Water",
];

const CLASS_8_MATHS = [
  "Rational Numbers",
  "Linear Equations in One Variable",
  "Understanding Quadrilaterals",
  "Practical Geometry",
  "Data Handling",
  "Squares and Square Roots",
  "Cubes and Cube Roots",
  "Comparing Quantities",
  "Algebraic Expressions and Identities",
  "Visualising Solid Shapes",
  "Mensuration",
  "Exponents and Powers",
  "Direct and Inverse Proportions",
  "Factorisation",
  "Introduction to Graphs",
  "Playing with Numbers",
];

const CLASS_8_SST = [
  "History · From Trade to Territory",
  "History · Ruling the Countryside",
  "History · When People Rebel",
  "History · Civilising the Native, Educating the Nation",
  "History · Women, Caste and Reform",
  "History · The Making of the National Movement: 1870s–1947",
  "History · India After Independence",
  "Geography · Resources",
  "Geography · Land, Soil, Water, Natural Vegetation and Wildlife",
  "Geography · Mineral and Power Resources",
  "Geography · Agriculture",
  "Geography · Industries",
  "Geography · Human Resources",
  "Civics · The Indian Constitution",
  "Civics · Understanding Secularism",
  "Civics · Parliament and the Making of Laws",
  "Civics · The Judiciary",
  "Civics · Understanding Marginalisation",
  "Civics · Public Facilities",
  "Economics · Factors of Production",
  "Economics · Natural Resources and Their Use",
];

const CLASS_8_ENGLISH = [
  "Prose · The Wit that Won Hearts",
  "Prose · A Concrete Example",
  "Prose · Wisdom Paves the Way",
  "Prose · A Tale of Valour: Major Somnath Sharma",
  "Poem · Somebody's Mother",
  "Prose · Verghese Kurien: I Too Had a Dream",
  "Prose · The Case of the Fifth Word",
  "Prose · The Magic Brush of Dreams",
  "Prose · Spectacular Wonders",
  "Prose · The Cherry Tree",
  "Poem · Harvest Hymn",
  "Prose · Waiting for the Rain",
  "Prose · Feathered Friend",
  "Writing Skills · Notice, Diary and Letter",
  "Grammar · Tenses, Voice and Reported Speech",
  "Reading · Unseen Comprehension",
];

const CLASS_8_HINDI = [
  "स्वदेश",
  "दो गौरैया",
  "एक आशीर्वाद",
  "हरिद्वार",
  "कबीर के दोहे",
  "एक टोकरी भर मिट्टी",
  "मत बाँधो",
  "नए मेहमान",
  "आदमी का अनुपात",
  "तरुण के स्वप्न",
  "व्याकरण · संधि, समास और वाच्य",
  "रचना · अनुच्छेद, पत्र और अपठित गद्यांश",
];

const CLASS_8_COMPUTER = [
  "Computer Fundamentals and Number Systems",
  "Networking and the Internet",
  "Spreadsheets and Data Analysis",
  "HTML and Web Page Design",
  "Introduction to Python",
  "Cyber Safety and Digital Citizenship",
];

/**
 * Artificial Intelligence.
 *
 * Skill subject code 417 is a CBSE secondary-school subject — Classes IX and X
 * only. CBSE does not run 417 at the middle-school level; Class 8 is taught
 * from the board's own AI facilitator handbook, whose five chapters are the
 * list below (no class 8 board exists, so there is no paper pattern to follow
 * there). Employability Skills units are kept because Part A of the 417 paper
 * is drawn from them.
 *
 * Sources: cbseacademic.nic.in 417 AI IX and X curriculum, 2025–26; the CBSE
 * Class VIII AI Facilitators' Handbook.
 */
const CLASS_8_AI = [
  "AI · Excite — meeting artificial intelligence",
  "AI · Relate — artificial intelligence around us",
  "AI · Purpose — problems AI is used for",
  "AI · Possibilities — what AI can and cannot do",
  "AI · Ethics — using AI responsibly",
];

const CLASS_9_AI = [
  "AI Reflection, Project Cycle and Ethics",
  "Data Literacy",
  "Math for AI — Statistics and Probability",
  "Introduction to Generative AI",
  "Introduction to Python",
  "Employability Skills · Communication Skills–I",
  "Employability Skills · Self-Management Skills–I",
  "Employability Skills · ICT Skills–I",
  "Employability Skills · Entrepreneurial Skills–I",
  "Employability Skills · Green Skills–I",
];

const CLASS_9_SCIENCE = [
  "Matter in Our Surroundings",
  "Is Matter Around Us Pure?",
  "Atoms and Molecules",
  "Structure of the Atom",
  "The Fundamental Unit of Life",
  "Tissues",
  "Motion",
  "Force and Laws of Motion",
  "Gravitation",
  "Work and Energy",
  "Sound",
  "Improvement in Food Resources",
];

const CLASS_9_MATHS = [
  "Number Systems",
  "Polynomials",
  "Coordinate Geometry",
  "Linear Equations in Two Variables",
  "Introduction to Euclid's Geometry",
  "Lines and Angles",
  "Triangles",
  "Quadrilaterals",
  "Circles",
  "Heron's Formula",
  "Surface Areas and Volumes",
  "Statistics",
  "Probability",
];

const CLASS_9_SST = [
  "History · The French Revolution",
  "History · Socialism in Europe and the Russian Revolution",
  "History · Nazism and the Rise of Hitler",
  "History · Forest Society and Colonialism",
  "History · Pastoralists in the Modern World",
  "Geography · India — Size and Location",
  "Geography · Physical Features of India",
  "Geography · Drainage",
  "Geography · Climate",
  "Geography · Natural Vegetation and Wildlife",
  "Geography · Population",
  "Civics · What is Democracy? Why Democracy?",
  "Civics · Constitutional Design",
  "Civics · Electoral Politics",
  "Civics · Working of Institutions",
  "Civics · Democratic Rights",
  "Economics · The Story of Village Palampur",
  "Economics · People as Resource",
  "Economics · Poverty as a Challenge",
  "Economics · Food Security in India",
];

const CLASS_9_ENGLISH = [
  "Prose · The Fun They Had",
  "Prose · The Sound of Music",
  "Prose · The Little Girl",
  "Prose · A Truly Beautiful Mind",
  "Prose · The Snake and the Mirror",
  "Prose · My Childhood",
  "Prose · Reach for the Top",
  "Prose · Kathmandu",
  "Prose · If I Were You",
  "Poem · The Road Not Taken",
  "Poem · Wind",
  "Poem · Rain on the Roof",
  "Poem · The Lake Isle of Innisfree",
  "Poem · A Legend of the Northland",
  "Poem · No Men Are Foreign",
  "Poem · On Killing a Tree",
  "Poem · A Slumber Did My Spirit Seal",
  "Supplementary · The Lost Child",
  "Supplementary · The Adventures of Toto",
  "Supplementary · Iswaran the Storyteller",
  "Supplementary · In the Kingdom of Fools",
  "Supplementary · The Happy Prince",
  "Supplementary · Weathering the Storm in Ersama",
  "Supplementary · The Last Leaf",
  "Supplementary · A House Is Not a Home",
  "Supplementary · The Beggar",
  "Writing Skills · Letter, Diary, Story and Analytical Paragraph",
  "Grammar · Tenses, Modals, Voice and Reported Speech",
  "Reading · Unseen Comprehension",
];

const CLASS_9_HINDI = [
  "दुःख का अधिकार",
  "एवरेस्ट: मेरी शिखर यात्रा",
  "तुम कब जाओगे, अतिथि",
  "वैज्ञानिक चेतना के वाहक: चंद्रशेखर वेंकट रामन",
  "धर्म की आड़",
  "शुक्रतारे के समान",
  "रैदास के पद",
  "रहीम के दोहे",
  "संचयन · गिल्लू",
  "संचयन · स्मृति",
  "संचयन · कल्लू कुम्हार की उनाकोटी",
  "संचयन · साँवले सपनों की याद",
  "व्याकरण · उपसर्ग, प्रत्यय और समास",
  "रचना · अनुच्छेद, पत्र और अपठित गद्यांश",
];

const CLASS_9_IT = [
  "Employability Skills",
  "Introduction to IT and ITeS Industry",
  "Data Entry and Keyboarding Skills",
  "Digital Documentation",
  "Electronic Spreadsheets",
  "Digital Presentation",
  "Cyber Safety",
];

const CLASS_10_AI = [
  "Revisiting the AI Project Cycle and Ethical Frameworks",
  "Advanced Concepts of Modelling in AI",
  "Evaluating Models",
  "Statistical Data",
  "Computer Vision",
  "Natural Language Processing",
  "Advanced Python",
  "Employability Skills · Communication Skills–II",
  "Employability Skills · Self-Management Skills–II",
  "Employability Skills · ICT Skills–II",
  "Employability Skills · Entrepreneurial Skills–II",
  "Employability Skills · Green Skills–II",
];

const CLASS_10_SCIENCE = [
  "Chemical Reactions and Equations",
  "Acids, Bases and Salts",
  "Metals and Non-metals",
  "Carbon and its Compounds",
  "Life Processes",
  "Control and Coordination",
  "How do Organisms Reproduce?",
  "Heredity",
  "Light — Reflection and Refraction",
  "The Human Eye and the Colourful World",
  "Electricity",
  "Magnetic Effects of Electric Current",
  "Our Environment",
];

const CLASS_10_MATHS = [
  "Real Numbers",
  "Polynomials",
  "Pair of Linear Equations in Two Variables",
  "Quadratic Equations",
  "Arithmetic Progressions",
  "Triangles",
  "Coordinate Geometry",
  "Introduction to Trigonometry",
  "Some Applications of Trigonometry",
  "Circles",
  "Areas Related to Circles",
  "Surface Areas and Volumes",
  "Statistics",
  "Probability",
];

const CLASS_10_SST = [
  "History · The Rise of Nationalism in Europe",
  "History · Nationalism in India",
  "History · The Making of a Global World",
  "History · The Age of Industrialisation",
  "History · Print Culture and the Modern World",
  "Geography · Resources and Development",
  "Geography · Forest and Wildlife Resources",
  "Geography · Water Resources",
  "Geography · Agriculture",
  "Geography · Minerals and Energy Resources",
  "Geography · Manufacturing Industries",
  "Geography · Lifelines of National Economy",
  "Civics · Power-sharing",
  "Civics · Federalism",
  "Civics · Gender, Religion and Caste",
  "Civics · Political Parties",
  "Civics · Outcomes of Democracy",
  "Economics · Development",
  "Economics · Sectors of the Indian Economy",
  "Economics · Money and Credit",
  "Economics · Globalisation and the Indian Economy",
  "Economics · Consumer Rights",
];

const CLASS_10_ENGLISH = [
  "Prose · A Letter to God",
  "Prose · Nelson Mandela: Long Walk to Freedom",
  "Prose · Two Stories about Flying",
  "Prose · From the Diary of Anne Frank",
  "Prose · Glimpses of India",
  "Prose · Mijbil the Otter",
  "Prose · Madam Rides the Bus",
  "Prose · The Sermon at Benares",
  "Prose · The Proposal",
  "Poem · Dust of Snow",
  "Poem · Fire and Ice",
  "Poem · A Tiger in the Zoo",
  "Poem · How to Tell Wild Animals",
  "Poem · The Ball Poem",
  "Poem · Amanda!",
  "Poem · The Trees",
  "Poem · Fog",
  "Poem · The Tale of Custard the Dragon",
  "Poem · For Anne Gregory",
  "Supplementary · A Triumph of Surgery",
  "Supplementary · The Thief's Story",
  "Supplementary · The Midnight Visitor",
  "Supplementary · A Question of Trust",
  "Supplementary · Footprints without Feet",
  "Supplementary · The Making of a Scientist",
  "Supplementary · The Necklace",
  "Supplementary · The Hack Driver",
  "Supplementary · Bholi",
  "Supplementary · The Book That Saved the Earth",
  "Writing Skills · Letter, Analytical Paragraph and Story",
  "Grammar · Tenses, Modals, Determiners and Reported Speech",
  "Reading · Unseen Comprehension",
];

const CLASS_10_HINDI = [
  "कबीर की साखियाँ",
  "मीरा के पद",
  "बिहारी के दोहे",
  "मनुष्यता — मैथिलीशरण गुप्त",
  "पर्वत प्रदेश में पावस — सुमित्रानंदन पंत",
  "मधुर-मधुर मेरे दीपक जल — महादेवी वर्मा",
  "तोप — वीरेन डंगवाल",
  "कर चले हम फ़िदा — कैफ़ी आज़मी",
  "आत्मत्राण — रवींद्रनाथ टैगोर",
  "संचयन · हरिहर काका",
  "संचयन · सपनों के-से दिन",
  "संचयन · टोपी शुक्ला",
  "व्याकरण · रचना के आधार पर वाक्य और वाच्य",
  "रचना · अनुच्छेद, पत्र और अपठित गद्यांश",
];

const CLASS_10_IT = [
  "Employability Skills",
  "Digital Documentation (Advanced)",
  "Electronic Spreadsheets (Advanced)",
  "Database Management System",
  "Web Applications and Web Security",
  "Cyber Safety and Digital Citizenship",
];

export const CLASSES: ClassSyllabus[] = [
  {
    id: "8",
    label: "Class 8",
    note:
      "No board paper at this stage — the paper follows the NCERT middle-school course your school teaches.",
    hasBoard: false,
    subjects: [
      { id: "science", name: "Science", chapters: CLASS_8_SCIENCE },
      { id: "maths", name: "Mathematics", chapters: CLASS_8_MATHS },
      { id: "social-science", name: "Social Science", chapters: CLASS_8_SST },
      { id: "english", name: "English", chapters: CLASS_8_ENGLISH },
      { id: "hindi", name: "Hindi", chapters: CLASS_8_HINDI },
      { id: "computer", name: "Computer / IT", chapters: CLASS_8_COMPUTER },
      { id: "ai", name: "Artificial Intelligence", chapters: CLASS_8_AI },
    ],
  },
  {
    id: "9",
    label: "Class 9",
    note:
      "Annual-exam pattern: the same paper structure your school uses, with the rationalised NCERT chapters.",
    hasBoard: false,
    subjects: [
      { id: "science", name: "Science", chapters: CLASS_9_SCIENCE },
      { id: "maths", name: "Mathematics", chapters: CLASS_9_MATHS },
      { id: "social-science", name: "Social Science", chapters: CLASS_9_SST },
      { id: "english", name: "English", chapters: CLASS_9_ENGLISH },
      { id: "hindi", name: "Hindi", chapters: CLASS_9_HINDI },
      { id: "computer", name: "Information Technology (402)", chapters: CLASS_9_IT },
      { id: "ai", name: "Artificial Intelligence (417)", chapters: CLASS_9_AI },
    ],
  },
  {
    id: "10",
    label: "Class 10",
    note:
      "Board year: 80 marks in 3 hours. Board simulation papers mix real CBSE questions from the 2020–2025 papers with fresh ones in the same pattern.",
    hasBoard: true,
    subjects: [
      { id: "science", name: "Science", chapters: CLASS_10_SCIENCE },
      { id: "maths", name: "Mathematics (Standard)", chapters: CLASS_10_MATHS },
      { id: "social-science", name: "Social Science", chapters: CLASS_10_SST },
      { id: "english", name: "English", chapters: CLASS_10_ENGLISH },
      { id: "hindi", name: "Hindi", chapters: CLASS_10_HINDI },
      { id: "computer", name: "Information Technology (402)", chapters: CLASS_10_IT },
      { id: "ai", name: "Artificial Intelligence (417)", chapters: CLASS_10_AI },
    ],
  },
];

export function findClass(id: string | undefined): ClassSyllabus | undefined {
  return CLASSES.find((entry) => entry.id === id);
}

export function findSubject(
  classId: string | undefined,
  subjectId: string | undefined,
): Subject | undefined {
  return findClass(classId)?.subjects.find((entry) => entry.id === subjectId);
}

export interface PaperPlan {
  mcq: number;
  short: number;
  long: number;
  totalMarks: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * How many questions a given clock should carry.
 *
 * The shape of a CBSE Class 10 paper is fixed — 20 MCQs, about 9 short answers
 * and 7 long answers across 80 marks and 180 minutes — so each section is
 * scaled from that paper's share of the clock: one MCQ per ~4.5 minutes, one
 * short answer per ~20, one long answer per ~26. A 15-minute paper therefore
 * gets a small complete paper (not four questions), and a 60-minute one gets
 * roughly a third of a board paper. Nothing is scaled below one written
 * question per section, and the section sizes are capped at the real paper's
 * maximum so a 5-hour request does not become an unmarkable monster.
 *
 * Objective papers follow the other real ratio: about one MCQ per 1.25
 * minutes.
 */
export function paperPlan(
  durationMinutes: number,
  pattern: ExamPattern,
): PaperPlan {
  const duration = clamp(Math.round(durationMinutes), 5, 300);

  if (pattern === "objective") {
    const mcq = clamp(Math.round(duration * 0.8), 8, 60);
    return { mcq, short: 0, long: 0, totalMarks: mcq };
  }

  const mcq = clamp(Math.round(duration * 0.22), 4, 20);
  const short = clamp(Math.round(duration * 0.05), 1, 9);
  const long = clamp(Math.round(duration * 0.04), 1, 7);

  return {
    mcq,
    short,
    long,
    totalMarks: mcq + short * 3 + long * 5,
  };
}

/** What a plan means in words, used in the setup screen before generating. */
export function describePlan(plan: PaperPlan, pattern: ExamPattern): string {
  if (pattern === "objective") {
    return `${plan.mcq} multiple-choice questions · ${plan.totalMarks} marks`;
  }
  return [
    `${plan.mcq} MCQ${plan.mcq === 1 ? "" : "s"}`,
    `${plan.short} short answer${plan.short === 1 ? "" : "s"}`,
    `${plan.long} long answer${plan.long === 1 ? "" : "s"}`,
    `${plan.totalMarks} marks`,
  ].join(" · ");
}

/** Combine the chosen chapters into the scope line the setter reads. */
export function scopeLine(chapters: string[]): string {
  const clean = chapters.map((chapter) => chapter.trim()).filter(Boolean);
  if (clean.length === 0) return "the whole syllabus";
  return clean.join("; ");
}
