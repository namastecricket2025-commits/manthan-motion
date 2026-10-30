export type LabQuestion = {
  question: string;
  model: string;
};

export type LabExperiment = {
  key: string;
  subject: "physics" | "chemistry" | "biology";
  title: string;
  bench: string;
  blurb: string;
  /** Progress rows written by a bench's Record button share this prefix. */
  prefix: string;
  worksheet: {
    aim: string;
    apparatus: string;
    procedure: string;
    questions: LabQuestion[];
  };
};

/**
 * The practicals that have something worth recording. Visual-only plates
 * (the heart model, the periodic table) are deliberately absent: a notebook
 * with nothing to write in it is worse than no notebook.
 */
export const EXPERIMENTS: LabExperiment[] = [
  {
    key: "biology-microscope",
    subject: "biology",
    title: "Microscope — plant and animal cells",
    bench: "Biology → Microscope",
    blurb: "Prepare a wet mount, focus at low power, then identify the tissue.",
    prefix: "biology-microscope",
    worksheet: {
      aim:
        "To observe plant and animal cells under a compound microscope and identify the structures visible at 4×, 10× and 40×.",
      apparatus:
        "Compound microscope, glass slides, coverslips, onion peel, cheek smear, safranin, methylene blue, dropper, forceps, blotting paper.",
      procedure:
        "1. Peel a thin membrane from the concave side of an onion scale and mount it in a drop of safranin.\n2. Lower the coverslip at an angle to avoid air bubbles.\n3. Focus at 4× with the coarse knob, then switch to 10× and 40× and use only the fine knob.\n4. Repeat with a cheek smear stained with methylene blue.\n5. Record the field diameter and the structures visible at each objective.",
      questions: [
        {
          question:
            "Why must the onion peel be thin and mounted in a liquid?",
          model:
            "A thick peel scatters light and stacks several cell layers, so no single layer is in focus. The liquid refractive index matches the cell and prevents drying; the coverslip flattens the specimen and excludes air.",
        },
        {
          question:
            "Why does the field become darker at 40× even when the lamp is unchanged?",
          model:
            "The high-power objective has a smaller aperture and a much smaller field, so less light reaches the eye. A real microscopist opens the iris diaphragm or raises the lamp after switching up.",
        },
        {
          question:
            "State one visible difference between the onion cell and the cheek cell.",
          model:
            "The onion cell has a rigid cell wall and a regular brick-like outline; the cheek cell has only a membrane, so its outline is irregular and it can change shape.",
        },
      ],
    },
  },
  {
    key: "physics-vernier-calipers",
    subject: "physics",
    title: "Vernier calipers",
    bench: "Physics → Instruments",
    blurb: "Read the main scale and vernier coincidence, then calculate the diameter.",
    prefix: "physics-vernier-calipers",
    worksheet: {
      aim:
        "To measure the diameter of the supplied specimens with vernier calipers and to determine the least count of the instrument.",
      apparatus:
        "Vernier calipers, four specimens (cylinder, sphere, block, thin rod), lens tissue.",
      procedure:
        "1. Close the jaws and check for zero error.\n2. Grip each specimen without over-tightening the jaws.\n3. Read the main scale before the vernier zero, then find the vernier division that coincides with a main-scale division.\n4. Calculate reading = main scale + (vernier coincidence × least count).\n5. Repeat each specimen at a different orientation and average the readings.",
      questions: [
        {
          question: "Why is the least count of these calipers 0.01 cm?",
          model:
            "Ten vernier divisions span nine main-scale millimetres, so one vernier division is 0.9 mm. The difference between one main division and one vernier division is 0.1 mm, which is 0.01 cm.",
        },
        {
          question: "What is zero error, and how would it affect the result?",
          model:
            "Zero error is a reading shown when the jaws are fully closed. A positive zero error makes every measured value too large; it must be subtracted. A negative error is added.",
        },
        {
          question:
            "Why should the specimen be measured in more than one orientation?",
          model:
            "Real specimens are not perfect cylinders or spheres. Several orientations sample the variation and reduce the effect of one bad reading on the mean.",
        },
      ],
    },
  },
  {
    key: "physics-screw-gauge",
    subject: "physics",
    title: "Screw gauge",
    bench: "Physics → Instruments",
    blurb: "Use the pitch and circular-scale division to read a wire diameter.",
    prefix: "physics-screw-gauge",
    worksheet: {
      aim:
        "To measure the diameter of a thin wire with a screw gauge and to calculate its least count.",
      apparatus: "Screw gauge, thin wire, lens tissue, metre scale.",
      procedure:
        "1. Find the pitch by rotating the thimble one full turn and noting the sleeve advance.\n2. Count the circular-scale divisions and calculate least count = pitch / divisions.\n3. Close the gap and check zero error.\n4. Place the wire between the studs and rotate the ratchet until it slips.\n5. Read the sleeve and thimble, apply the zero correction, and repeat at three places.",
      questions: [
        {
          question: "Why is the ratchet used instead of forcing the thimble?",
          model:
            "The ratchet slips at a set torque. It prevents over-tightening, which would compress a soft wire and give a reading smaller than the true diameter.",
        },
        {
          question: "How is the least count calculated for this gauge?",
          model:
            "Least count = pitch ÷ number of circular-scale divisions. With a 0.5 mm pitch and 50 divisions it is 0.01 mm.",
        },
        {
          question: "Why is the wire measured at three different places?",
          model:
            "The wire may not be uniform. Three readings show the spread and let the mean represent the wire better than one measurement.",
        },
      ],
    },
  },
  {
    key: "chemistry-titration",
    subject: "chemistry",
    title: "Acid–base titration",
    bench: "Chemistry → Titration",
    blurb: "Run the burette, watch the indicator, and calculate the concentration.",
    prefix: "chemistry-titration",
    worksheet: {
      aim:
        "To determine the concentration of an acid (or base) by titrating it against a standard solution and locating the endpoint.",
      apparatus:
        "Burette, pipette, conical flask, burette stand, funnel, phenolphthalein, standard solution, analyte, wash bottle.",
      procedure:
        "1. Rinse the burette with the titrant and fill it, removing the air gap below the tap.\n2. Pipette a measured volume of analyte into a clean conical flask and add two drops of indicator.\n3. Run the titrant in, swirling, until a permanent colour change lasts 30 seconds.\n4. Record the initial and final burette readings and repeat for concordant values.\n5. Calculate the concentration using the balanced equation and the mean titre.",
      questions: [
        {
          question: "Why is the conical flask swirled during the titration?",
          model:
            "Swirling mixes the incoming titrant with the analyte so the reaction is complete and local excess does not produce a false early endpoint.",
        },
        {
          question: "Why is the endpoint not exactly the same as the equivalence point?",
          model:
            "The endpoint is where the indicator changes colour, which may be slightly before or after the equivalence point. A well-chosen indicator and a slow final addition keep the difference small.",
        },
        {
          question: "Why are concordant readings used rather than the first one?",
          model:
            "Concordant titres are within a small range and show the method is reproducible. Averaging them reduces random error from the first rough titration.",
        },
      ],
    },
  },
  {
    key: "chemistry-salt-analysis",
    subject: "chemistry",
    title: "Qualitative salt analysis",
    bench: "Chemistry → Salt Analysis",
    blurb: "Run tests on a salt, infer the cation and anion, then name it.",
    prefix: "chemistry-salt-analysis",
    worksheet: {
      aim:
        "To identify the cation and anion in a supplied salt and confirm the identity of the salt.",
      apparatus:
        "Salt samples, test tubes, test-tube holder, spirit lamp, dilute HCl, NaOH, NH4OH, barium chloride, ammonium oxalate, glass rod.",
      procedure:
        "1. Note the colour and solubility of the salt.\n2. Add dilute HCl and record any gas, smell or precipitate.\n3. Add NaOH and warm; test any gas with moist indicator paper.\n4. Add the group reagent for the cation and record the precipitate.\n5. Compare the observations with the qualitative analysis table and name the salt.",
      questions: [
        {
          question: "Why is the flame test not used for every salt?",
          model:
            "Flame colour can be masked by a stronger emitter or by the container, and some cations do not give a clean colour. Wet tests are more reliable for those ions.",
        },
        {
          question: "Why is the salt first tested with dilute HCl?",
          model:
            "Dilute acid detects carbonate, bicarbonate, sulphite and sulphide ions by the gas evolved. It also removes carbonate interference before the cation tests.",
        },
        {
          question: "Why must the observations be recorded before the salt is named?",
          model:
            "The name is an inference, not an observation. Recording each test separately lets another student check the reasoning and catches a conclusion that does not follow.",
        },
      ],
    },
  },
  {
    key: "physics-lens-practical",
    subject: "physics",
    title: "Lens focal length",
    bench: "Physics → Optics",
    blurb: "Find the image, read the distances and calculate the focal length.",
    prefix: "physics-lens-practical",
    worksheet: {
      aim:
        "To find the focal length of a convex (or concave) lens by measuring object and image distances.",
      apparatus:
        "Lens, optical bench, illuminated object, screen, metre scale, lens holder.",
      procedure:
        "1. Arrange the object, lens and screen along the optical axis.\n2. Adjust the screen until the image is sharp and record the object and image distances.\n3. Repeat for at least four object distances.\n4. Use 1/f = 1/v - 1/u, with the sign convention your syllabus uses.\n5. Plot a graph and compare the mean focal length with the value from the graph.",
      questions: [
        {
          question: "Why must the object, lens and screen be on one axis?",
          model:
            "If they are off axis the image forms to one side or is distorted, so the measured distances do not correspond to the lens formula and the focal length is wrong.",
        },
        {
          question: "What does the sign of the image distance tell you?",
          model:
            "By the Cartesian convention a positive image distance means a real image on the far side of the lens; a negative distance means a virtual image on the same side as the object.",
        },
        {
          question: "Why repeat the measurement at different object distances?",
          model:
            "A single pair can contain a large placement error. Several pairs, or a graph, expose outliers and give a focal length that is not tied to one reading.",
        },
      ],
    },
  },
];

export function findExperiment(key: string): LabExperiment {
  return EXPERIMENTS.find((entry) => entry.key === key) ?? EXPERIMENTS[0];
}

export function progressKey(subject: string, title: string) {
  return `${subject}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function matchesExperiment(key: string, experiment: LabExperiment) {
  return key === experiment.key || key.startsWith(experiment.prefix);
}

export function blankContent(experiment: LabExperiment) {
  return {
    aim: experiment.worksheet.aim,
    apparatus: experiment.worksheet.apparatus,
    procedure: experiment.worksheet.procedure,
    observations: "",
    conclusion: "",
    answers: experiment.worksheet.questions.map((question) => ({
      question: question.question,
      answer: "",
    })),
  };
}
