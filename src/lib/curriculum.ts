/**
 * The school syllabus behind the mock exam and the viva.
 *
 * Until now a paper could only come from a notebook the student had built
 * themselves, which meant an empty account could not sit a single test. This
 * file is the other half: the CBSE / NCERT chapter lists for Classes 8 to 12,
 * and the arithmetic that decides how big a paper should be for a given clock.
 *
 * Chapter names follow the NCERT textbooks in use in the 2026–27 session:
 *  - Classes 8 and 9 use the new NEP books (Curiosity, Ganita Prakash,
 *    Exploring Society for 8; Exploration, Ganita Manjari, Kaveri, Ganga and
 *    Understanding Society for 9).
 *  - Class 10 continues with the older rationalised books until the revised
 *    Grade 10 books arrive in 2027–28.
 *  - Classes 11 and 12 use the existing NCERT books; the core subjects of the
 *    Science, Commerce and Humanities streams are listed.
 * Social Science and English are prefixed with their book or strand ("History ·
 * Nationalism in India", "Poem · Dust of Snow") so a chapter is unambiguous in
 * a dropdown and in a prompt.
 *
 * Sources: cbseacademic.nic.in (Curriculum 2026–27) and the NCERT textbook
 * contents pages for Classes 8–12.
 */

export type ClassId = "8" | "9" | "10" | "11" | "12";

export type SubjectId =
  | "science"
  | "maths"
  | "social-science"
  | "english"
  | "hindi"
  | "computer"
  | "ai"
  | "physics"
  | "chemistry"
  | "biology"
  | "accountancy"
  | "business-studies"
  | "economics"
  | "history"
  | "political-science"
  | "geography"
  | "psychology"
  | "sociology";

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

/* Class 8 — NCERT's 2025–26 books, continuing in 2026–27. */
const CLASS_8_SCIENCE = [
  "Exploring the Investigative World of Science",
  "The Invisible Living World: Beyond Our Naked Eye",
  "Health: The Ultimate Treasure",
  "Electricity: Magnetic and Heating Effects",
  "Exploring Forces",
  "Pressure, Winds, Storms, and Cyclones",
  "Particulate Nature of Matter",
  "Nature of Matter: Elements, Compounds, and Mixtures",
  "The Amazing World of Solutes, Solvents, and Solutions",
  "Light: Mirrors and Lenses",
  "Keeping Time with the Skies",
  "How Nature Works in Harmony",
  "Our Home: Earth, a Unique Life Sustaining Planet",
];

const CLASS_8_MATHS = [
  "A Square and A Cube",
  "Power Play",
  "A Story of Numbers",
  "Quadrilaterals",
  "Number Play",
  "We Distribute, Yet Things Multiply",
  "Proportional Reasoning 1",
  "Fractions in Disguise",
  "The Baudhayana-Pythagoras Theorem",
  "Proportional Reasoning 2",
  "Exploring Some Geometric Themes",
  "Tales by Dots and Lines",
  "Algebra Play",
  "Area",
];

const CLASS_8_SST = [
  "Natural Resources and Their Use",
  "Reshaping India's Political Map",
  "The Rise of the Marathas",
  "The Colonial Era in India",
  "Universal Franchise and India's Electoral System",
  "The Parliamentary System: Legislature and Executive",
  "Factors of Production",
  "World Geography: Some Glimpses",
  "India's Long Road to Independence",
  "A Journey Through Indian Architecture",
  "The Role of the Judiciary in Our Society",
  "Citizenship: Rights and Duties",
  "Dynamics of Population",
  "India's Urban Landscape",
  "Cultural Currents: 13th to 17th Centuries",
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

/* Class 9 — the new NCERT books introduced for 2026–27. */
const CLASS_9_SCIENCE = [
  "Exploration: Entering the World of Secondary Science",
  "Cell: The Building Block of Life",
  "Tissues in Action",
  "Describing Motion Around Us",
  "Exploring Mixtures and their Separation",
  "How Forces Affect Motion",
  "Work, Energy and Simple Machines",
  "Journey Inside the Atom",
  "Atomic Foundations of Matter",
  "Sound Waves: Characteristics and Applications",
  "Reproduction: How Life Continues",
  "Patterns in Life: Diversity and Classification",
  "Earth as a System: Energy, Matter, and Life",
];

const CLASS_9_MATHS = [
  "Orienting Yourself: The Use of Coordinates",
  "Introduction to Linear Polynomials",
  "The World of Numbers",
  "Exploring Algebraic Identities",
  "I'm Up and Down, and Round and Round",
  "Measuring Space: Perimeter and Area",
  "The Mathematics of Maybe: Introduction to Probability",
  "Predicting What Comes Next: Exploring Sequences and Progressions",
  "Propositions and their Converses",
  "How Quantities Combine: Understanding Data",
  "The World of Algorithms",
  "Quadrilaterals",
  "Two Variables, One Line",
  "Math of Space: Surface Area and Volume",
];

const CLASS_9_SST = [
  "Understanding Social Science",
  "Shaping of the Earth's Surface",
  "Atmosphere and Climate",
  "Early Humans and Beginning of Civilisation",
  "State and Society up to 1000 CE",
  "Democracy",
  "Elections",
  "Building Blocks in Economics: The Problem of Choice",
  "The Price Puzzle: What Drives the Market",
  "Oceans and Life",
  "Life on Earth",
  "Resistance and Resilience (1000–1700 CE)",
  "Governance and Public Policy",
  "Managing Your Personal Finances",
  "From Ideas to Startups",
];

const CLASS_9_ENGLISH = [
  "Prose · How I Taught My Grandmother to Read",
  "Prose · The Pot Maker",
  "Prose · Winds of Change",
  "Prose · Vitamin-M",
  "Prose · The World of Limitless Possibilities",
  "Prose · Twin Melodies",
  "Prose · Carrier of Words",
  "Prose · Follow That Dream",
  "Poem · Bharat Our Land",
  "Poem · Gifts of Grace: Honouring Our Vocations",
  "Poem · Canvas of Soil",
  "Poem · I Cannot Remember My Mother",
  "Poem · Nine Gold Medals",
  "Poem · A Friend Found in Music",
  "Poem · Words",
  "Poem · Believe in Yourself",
  "Writing Skills · Notice, Diary, Letter and Story",
  "Grammar · Tenses, Modals, Voice and Reported Speech",
  "Reading · Unseen Comprehension",
];

const CLASS_9_HINDI = [
  "दो बैलों की कथा",
  "क्या लिखूँ?",
  "संवादहीन",
  "ऐसी भी बातें होती हैं",
  "आखिरी चट्टान तक",
  "रीढ़ की हड्डी",
  "मैं और मेरा देश",
  "पद",
  "राम-लक्ष्मण-परशुराम संवाद",
  "भारति, जय, विजय करे!",
  "झाँसी की रानी",
  "घर की याद",
  "निर्मल जीत सिंह सेखों",
  "तब याद तुम्हारी आती है",
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
];

/*
 * Senior secondary — Classes 11 and 12.
 *
 * The three streams share one list because a student picks their own subjects
 * and combinations are common (Economics with Mathematics, Biology with
 * Psychology). Chapter names follow the NCERT books and the CBSE 2026–27
 * syllabus; Accountancy, Business Studies and Economics are listed by the
 * syllabus units, which is how CBSE prints them.
 */
const CLASS_11_ENGLISH = [
  "Prose · The Portrait of a Lady",
  "Poem · A Photograph",
  "Prose · We're Not Afraid to Die… If We Can All Be Together",
  "Prose · Discovering Tut: The Saga Continues",
  "Poem · The Laburnum Top",
  "Poem · The Voice of the Rain",
  "Poem · Childhood",
  "Prose · The Adventure",
  "Prose · Silk Road",
  "Poem · Father to Son",
  "Supplementary · The Summer of the Beautiful White Horse",
  "Supplementary · The Address",
  "Supplementary · Mother's Day",
  "Supplementary · Birth",
  "Supplementary · The Tale of Melon City",
  "Writing Skills · Notice, Letter, Article and Report",
  "Grammar · Tenses, Voice, Modals and Reported Speech",
  "Reading · Unseen Comprehension",
];

const CLASS_11_PHYSICS = [
  "Units and Measurements",
  "Motion in a Straight Line",
  "Motion in a Plane",
  "Laws of Motion",
  "Work, Energy and Power",
  "System of Particles and Rotational Motion",
  "Gravitation",
  "Mechanical Properties of Solids",
  "Mechanical Properties of Fluids",
  "Thermal Properties of Matter",
  "Thermodynamics",
  "Kinetic Theory",
  "Oscillations",
  "Waves",
];

const CLASS_11_CHEMISTRY = [
  "Some Basic Concepts of Chemistry",
  "Structure of Atom",
  "Classification of Elements and Periodicity in Properties",
  "Chemical Bonding and Molecular Structure",
  "Thermodynamics",
  "Equilibrium",
  "Redox Reactions",
  "Organic Chemistry – Some Basic Principles and Techniques",
  "Hydrocarbons",
];

const CLASS_11_MATHS = [
  "Sets",
  "Relations and Functions",
  "Trigonometric Functions",
  "Complex Numbers and Quadratic Equations",
  "Linear Inequalities",
  "Permutations and Combinations",
  "Binomial Theorem",
  "Sequences and Series",
  "Straight Lines",
  "Conic Sections",
  "Introduction to Three Dimensional Geometry",
  "Limits and Derivatives",
  "Statistics",
  "Probability",
];

const CLASS_11_BIOLOGY = [
  "The Living World",
  "Biological Classification",
  "Plant Kingdom",
  "Animal Kingdom",
  "Morphology of Flowering Plants",
  "Anatomy of Flowering Plants",
  "Structural Organisation in Animals",
  "Cell: The Unit of Life",
  "Biomolecules",
  "Cell Cycle and Cell Division",
  "Photosynthesis in Higher Plants",
  "Respiration in Plants",
  "Plant Growth and Development",
  "Breathing and Exchange of Gases",
  "Body Fluids and Circulation",
  "Excretory Products and their Elimination",
  "Locomotion and Movement",
  "Neural Control and Coordination",
  "Chemical Coordination and Integration",
];

const CLASS_11_COMPUTER = [
  "Computer System",
  "Encoding Schemes and Number System",
  "Emerging Trends",
  "Introduction to Problem Solving",
  "Getting Started with Python",
  "Flow of Control",
  "Functions",
  "Strings",
  "Lists",
  "Tuples and Dictionaries",
  "Societal Impact",
];

const CLASS_11_ACCOUNTANCY = [
  "Unit 1 · Theoretical Framework",
  "Unit 2 · Accounting Process",
  "Unit 3 · Financial Statements of Sole Proprietorship",
];

const CLASS_11_BUSINESS = [
  "Unit 1 · Evolution and Fundamentals of Business",
  "Unit 2 · Forms of Business Organisations",
  "Unit 3 · Public, Private and Global Enterprises",
  "Unit 4 · Business Services",
  "Unit 5 · Emerging Modes of Business",
  "Unit 6 · Social Responsibility of Business and Business Ethics",
  "Unit 7 · Sources of Business Finance",
  "Unit 8 · Small Business and Enterprises",
  "Unit 9 · Internal Trade",
  "Unit 10 · International Business",
];

const CLASS_11_ECONOMICS = [
  "Unit 1 · Introduction to Economics",
  "Unit 2 · Collection, Organisation and Presentation of Data",
  "Unit 3 · Statistical Tools and Interpretation",
  "Unit 4 · Introduction to Microeconomics",
  "Unit 5 · Consumer's Equilibrium and Demand",
  "Unit 6 · Producer Behaviour and Supply",
  "Unit 7 · Forms of Market and Price Determination",
];

const CLASS_11_HISTORY = [
  "Writing and City Life",
  "An Empire Across Three Continents",
  "Nomadic Empires",
  "The Three Orders",
  "Changing Cultural Traditions",
  "Displacing Indigenous Peoples",
  "Paths to Modernisation",
];

const CLASS_11_POLITICAL_SCIENCE = [
  "Indian Constitution · Constitution: Why and How?",
  "Indian Constitution · Rights in the Indian Constitution",
  "Indian Constitution · Election and Representation",
  "Indian Constitution · Executive",
  "Indian Constitution · Legislature",
  "Indian Constitution · Judiciary",
  "Indian Constitution · Federalism",
  "Indian Constitution · Local Governments",
  "Indian Constitution · Constitution as a Living Document",
  "Indian Constitution · The Philosophy of the Constitution",
  "Political Theory · An Introduction",
  "Political Theory · Freedom",
  "Political Theory · Equality",
  "Political Theory · Social Justice",
  "Political Theory · Rights",
  "Political Theory · Citizenship",
  "Political Theory · Nationalism",
  "Political Theory · Secularism",
  "Political Theory · Peace",
  "Political Theory · Development",
];

const CLASS_11_GEOGRAPHY = [
  "Physical Geography · Geography as a Discipline",
  "Physical Geography · The Origin and Evolution of the Earth",
  "Physical Geography · Interior of the Earth",
  "Physical Geography · Distribution of Oceans and Continents",
  "Physical Geography · Minerals and Rocks",
  "Physical Geography · Geomorphic Processes",
  "Physical Geography · Landforms and their Evolution",
  "Physical Geography · Composition and Structure of Atmosphere",
  "Physical Geography · Solar Radiation, Heat Balance and Temperature",
  "Physical Geography · Atmospheric Circulation and Weather Systems",
  "Physical Geography · Water in the Atmosphere",
  "Physical Geography · World Climate and Climate Change",
  "Physical Geography · Water (Oceans)",
  "Physical Geography · Movements of Ocean Water",
  "Physical Geography · Life on the Earth",
  "Physical Geography · Biodiversity and Conservation",
  "India: Physical Environment · India — Location",
  "India: Physical Environment · Structure and Physiography",
  "India: Physical Environment · Drainage System",
  "India: Physical Environment · Climate",
  "India: Physical Environment · Natural Vegetation",
  "India: Physical Environment · Soils",
  "India: Physical Environment · Natural Hazards and Disasters",
];

const CLASS_11_PSYCHOLOGY = [
  "What is Psychology?",
  "Methods of Enquiry in Psychology",
  "The Bases of Human Behaviour",
  "Human Development",
  "Sensory, Attentional and Perceptual Processes",
  "Learning",
  "Human Memory",
  "Thinking",
  "Motivation and Emotion",
];

const CLASS_11_SOCIOLOGY = [
  "Introducing Sociology · Sociology and Society",
  "Introducing Sociology · Terms, Concepts and their Use in Sociology",
  "Introducing Sociology · Understanding Social Institutions",
  "Introducing Sociology · Culture and Socialisation",
  "Introducing Sociology · Doing Sociology: Research Methods",
  "Understanding Society · Social Structure, Stratification and Social Processes",
  "Understanding Society · Social Change and Social Order in Rural and Urban Society",
  "Understanding Society · Environment and Society",
  "Understanding Society · Introducing Western Sociologists",
  "Understanding Society · Indian Sociologists",
];

const CLASS_12_ENGLISH = [
  "Prose · The Last Lesson",
  "Prose · Lost Spring",
  "Prose · Deep Water",
  "Prose · The Rattrap",
  "Prose · Indigo",
  "Prose · Poets and Pancakes",
  "Prose · The Interview",
  "Prose · Going Places",
  "Poem · My Mother at Sixty-Six",
  "Poem · Keeping Quiet",
  "Poem · A Thing of Beauty",
  "Poem · A Roadside Stand",
  "Poem · Aunt Jennifer's Tigers",
  "Supplementary · The Third Level",
  "Supplementary · The Tiger King",
  "Supplementary · Journey to the End of the Earth",
  "Supplementary · The Enemy",
  "Supplementary · On the Face of It",
  "Supplementary · Memories of Childhood",
  "Writing Skills · Notice, Letter, Article and Report",
  "Grammar · Tenses, Voice, Modals and Reported Speech",
  "Reading · Unseen Comprehension",
];

const CLASS_12_PHYSICS = [
  "Electric Charges and Fields",
  "Electrostatic Potential and Capacitance",
  "Current Electricity",
  "Moving Charges and Magnetism",
  "Magnetism and Matter",
  "Electromagnetic Induction",
  "Alternating Current",
  "Electromagnetic Waves",
  "Ray Optics and Optical Instruments",
  "Wave Optics",
  "Dual Nature of Radiation and Matter",
  "Atoms",
  "Nuclei",
  "Semiconductor Electronics: Materials, Devices and Simple Circuits",
];

const CLASS_12_CHEMISTRY = [
  "Solutions",
  "Electrochemistry",
  "Chemical Kinetics",
  "The d- and f-Block Elements",
  "Coordination Compounds",
  "Haloalkanes and Haloarenes",
  "Alcohols, Phenols and Ethers",
  "Aldehydes, Ketones and Carboxylic Acids",
  "Amines",
  "Biomolecules",
];

const CLASS_12_MATHS = [
  "Relations and Functions",
  "Inverse Trigonometric Functions",
  "Matrices",
  "Determinants",
  "Continuity and Differentiability",
  "Applications of Derivatives",
  "Integrals",
  "Application of Integrals",
  "Differential Equations",
  "Vector Algebra",
  "Three Dimensional Geometry",
  "Linear Programming",
  "Probability",
];

const CLASS_12_BIOLOGY = [
  "Sexual Reproduction in Flowering Plants",
  "Human Reproduction",
  "Reproductive Health",
  "Principles of Inheritance and Variation",
  "Molecular Basis of Inheritance",
  "Evolution",
  "Human Health and Disease",
  "Microbes in Human Welfare",
  "Biotechnology: Principles and Processes",
  "Biotechnology and its Applications",
  "Organisms and Populations",
  "Ecosystem",
  "Biodiversity and Conservation",
];

const CLASS_12_COMPUTER = [
  "Computational Thinking and Programming – 2",
  "Computer Networks",
  "Database Management",
];

const CLASS_12_ACCOUNTANCY = [
  "Unit 1 · Accounting for Partnership Firms",
  "Unit 2 · Accounting for Companies",
  "Unit 3 · Analysis of Financial Statements",
  "Unit 4 · Cash Flow Statement",
  "Unit 5 · Computerized Accounting",
];

const CLASS_12_BUSINESS = [
  "Unit 1 · Nature and Significance of Management",
  "Unit 2 · Principles of Management",
  "Unit 3 · Business Environment",
  "Unit 4 · Planning",
  "Unit 5 · Organising",
  "Unit 6 · Staffing",
  "Unit 7 · Directing",
  "Unit 8 · Controlling",
  "Unit 9 · Financial Management",
  "Unit 10 · Financial Markets",
  "Unit 11 · Marketing",
  "Unit 12 · Consumer Protection",
];

const CLASS_12_ECONOMICS = [
  "Unit 1 · National Income and Related Aggregates",
  "Unit 2 · Money and Banking",
  "Unit 3 · Determination of Income and Employment",
  "Unit 4 · Government Budget and the Economy",
  "Unit 5 · Balance of Payments",
  "Unit 6 · Development Experience (1947–90) and Economic Reforms since 1991",
  "Unit 7 · Current Challenges Facing the Indian Economy",
  "Unit 8 · Development Experience of India: A Comparison with Neighbours",
];

const CLASS_12_HISTORY = [
  "Bricks, Beads and Bones — The Harappan Civilisation",
  "Kings, Farmers and Towns — Early States and Economies",
  "Kinship, Caste and Class — Early Societies",
  "Thinkers, Beliefs and Buildings — Cultural Developments",
  "Through the Eyes of Travellers — Perceptions of Society",
  "Bhakti-Sufi Traditions — Changes in Religious Beliefs and Devotional Texts",
  "An Imperial Capital: Vijayanagara",
  "Peasants, Zamindars and the State — Agrarian Society and the Mughal Empire",
  "Colonialism and the Countryside — Exploring Official Archives",
  "Rebels and the Raj — The Revolt of 1857 and Its Representations",
  "Mahatma Gandhi and the Nationalist Movement — Civil Disobedience and Beyond",
  "Framing the Constitution — The Beginning of a New Era",
];

const CLASS_12_POLITICAL_SCIENCE = [
  "Contemporary World Politics · The End of Bipolarity",
  "Contemporary World Politics · Contemporary Centres of Power",
  "Contemporary World Politics · Contemporary South Asia",
  "Contemporary World Politics · International Organisations",
  "Contemporary World Politics · Security in the Contemporary World",
  "Contemporary World Politics · Environment and Natural Resources",
  "Contemporary World Politics · Globalisation",
  "Politics in India · Challenges of Nation-Building",
  "Politics in India · Era of One-Party Dominance",
  "Politics in India · Politics of Planned Development",
  "Politics in India · India's External Relations",
  "Politics in India · Challenges to and Restoration of the Congress System",
  "Politics in India · The Crisis of Democratic Order",
  "Politics in India · Regional Aspirations",
  "Politics in India · Recent Developments in Indian Politics",
];

const CLASS_12_GEOGRAPHY = [
  "Human Geography · Human Geography: Nature and Scope",
  "Human Geography · The World Population: Distribution, Density and Growth",
  "Human Geography · Population Composition",
  "Human Geography · Human Development",
  "Human Geography · Primary Activities",
  "Human Geography · Secondary Activities",
  "Human Geography · Tertiary and Quaternary Activities",
  "Human Geography · Transport and Communication",
  "Human Geography · International Trade",
  "Human Geography · Human Settlements",
  "India: People and Economy · Population: Distribution, Density, Growth and Composition",
  "India: People and Economy · Migration: Types, Causes and Consequences",
  "India: People and Economy · Human Development",
  "India: People and Economy · Human Settlements",
  "India: People and Economy · Land Resources and Agriculture",
  "India: People and Economy · Water Resources",
  "India: People and Economy · Mineral and Energy Resources",
  "India: People and Economy · Manufacturing Industries",
  "India: People and Economy · Planning and Sustainable Development",
  "India: People and Economy · Transport and Communication",
  "India: People and Economy · International Trade",
  "India: People and Economy · Geographical Perspective on Selected Issues",
];

const CLASS_12_PSYCHOLOGY = [
  "Variations in Psychological Attributes",
  "Self and Personality",
  "Meeting Life Challenges",
  "Psychological Disorders",
  "Therapeutic Approaches",
  "Attitude and Social Cognition",
  "Social Influence and Group Processes",
];

const CLASS_12_SOCIOLOGY = [
  "Indian Society · Introducing Indian Society",
  "Indian Society · The Demographic Structure of the Indian Society",
  "Indian Society · Social Institutions: Continuity and Change",
  "Indian Society · The Market as a Social Institution",
  "Indian Society · Patterns of Social Inequality and Exclusion",
  "Indian Society · The Challenges of Cultural Diversity",
  "Social Change · Structural Change",
  "Social Change · Cultural Change",
  "Social Change · The Story of Indian Democracy",
  "Social Change · Change and Development in Rural Society",
  "Social Change · Change and Development in Industrial Society",
  "Social Change · Globalisation and Social Change",
  "Social Change · Mass Media and Communications",
  "Social Change · Social Movements",
];

export const CLASSES: ClassSyllabus[] = [
  {
    id: "8",
    label: "Class 8",
    note:
      "New NCERT books from 2025–26 (Curiosity, Ganita Prakash, Exploring Society). No board paper at this stage — the paper follows the middle-school course your school teaches.",
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
      "New NCERT books for 2026–27 (Exploration, Ganita Manjari, Kaveri, Ganga, Understanding Society). Annual-exam pattern, the same structure your school uses.",
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
      "Board year: 80 marks in 3 hours. Board simulation papers mix real CBSE questions from the 2020–2026 papers with fresh ones in the same pattern.",
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
  {
    id: "11",
    label: "Class 11",
    note:
      "First year of senior secondary: the subjects you opt for decide the paper. Papers follow the CBSE 2026–27 school pattern, and board-pattern practice is available for every subject.",
    hasBoard: true,
    subjects: [
      { id: "english", name: "English Core", chapters: CLASS_11_ENGLISH },
      { id: "physics", name: "Physics", chapters: CLASS_11_PHYSICS },
      { id: "chemistry", name: "Chemistry", chapters: CLASS_11_CHEMISTRY },
      { id: "maths", name: "Mathematics", chapters: CLASS_11_MATHS },
      { id: "biology", name: "Biology", chapters: CLASS_11_BIOLOGY },
      { id: "computer", name: "Computer Science", chapters: CLASS_11_COMPUTER },
      { id: "accountancy", name: "Accountancy", chapters: CLASS_11_ACCOUNTANCY },
      { id: "business-studies", name: "Business Studies", chapters: CLASS_11_BUSINESS },
      { id: "economics", name: "Economics", chapters: CLASS_11_ECONOMICS },
      { id: "history", name: "History", chapters: CLASS_11_HISTORY },
      { id: "political-science", name: "Political Science", chapters: CLASS_11_POLITICAL_SCIENCE },
      { id: "geography", name: "Geography", chapters: CLASS_11_GEOGRAPHY },
      { id: "psychology", name: "Psychology", chapters: CLASS_11_PSYCHOLOGY },
      { id: "sociology", name: "Sociology", chapters: CLASS_11_SOCIOLOGY },
    ],
  },
  {
    id: "12",
    label: "Class 12",
    note:
      "Board year: 80 marks in 3 hours. Papers follow the CBSE board pattern with the chapters your stream covers; the saved past-paper question bank currently holds Class 10 questions.",
    hasBoard: true,
    subjects: [
      { id: "english", name: "English Core", chapters: CLASS_12_ENGLISH },
      { id: "physics", name: "Physics", chapters: CLASS_12_PHYSICS },
      { id: "chemistry", name: "Chemistry", chapters: CLASS_12_CHEMISTRY },
      { id: "maths", name: "Mathematics", chapters: CLASS_12_MATHS },
      { id: "biology", name: "Biology", chapters: CLASS_12_BIOLOGY },
      { id: "computer", name: "Computer Science", chapters: CLASS_12_COMPUTER },
      { id: "accountancy", name: "Accountancy", chapters: CLASS_12_ACCOUNTANCY },
      { id: "business-studies", name: "Business Studies", chapters: CLASS_12_BUSINESS },
      { id: "economics", name: "Economics", chapters: CLASS_12_ECONOMICS },
      { id: "history", name: "History", chapters: CLASS_12_HISTORY },
      { id: "political-science", name: "Political Science", chapters: CLASS_12_POLITICAL_SCIENCE },
      { id: "geography", name: "Geography", chapters: CLASS_12_GEOGRAPHY },
      { id: "psychology", name: "Psychology", chapters: CLASS_12_PSYCHOLOGY },
      { id: "sociology", name: "Sociology", chapters: CLASS_12_SOCIOLOGY },
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
 * Pacing follows what schools and testing bodies actually use: about a minute
 * per multiple-choice question (the common 1-minute-per-item benchmark), and
 * the fixed shape of a CBSE board paper — 20 MCQs, 9 short answers and 7 long
 * answers across 80 marks in 180 minutes — for the mixed pattern. The mixed
 * sections scale from that paper's own rhythm: one MCQ per two minutes, one
 * short answer per twelve, one long answer per twenty, so a 15-minute paper is
 * a real short test (about ten questions) instead of six, a 60-minute one sits
 * at 28, and three hours reproduces the board paper exactly at 36.
 * Nothing is scaled below one written question per section, and the section
 * sizes are capped at the real paper's maximum so a 5-hour request does not
 * become an unmarkable monster.
 */
export function paperPlan(
  durationMinutes: number,
  pattern: ExamPattern,
): PaperPlan {
  const duration = clamp(Math.round(durationMinutes), 5, 300);

  if (pattern === "objective") {
    // One MCQ a minute, floor for a five-minute quiz, cap so an afternoon of
    // paper does not turn into 300 questions.
    const mcq = clamp(duration, 5, 60);
    return { mcq, short: 0, long: 0, totalMarks: mcq };
  }

  const mcq = clamp(Math.round(duration / 2), 4, 20);
  const short = clamp(Math.round(duration / 12), 1, 9);
  const long = clamp(Math.round(duration / 20), 1, 7);

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
