import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

let aiClient: any = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Basic health-check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Voice Assistant Agent processing route
  app.post("/api/voice-assistant", async (req, res) => {
    try {
      const { message, lang, farmContext, personality } = req.body;
      if (!message) {
        return res.status(400).json({ error: "No voice or text input received." });
      }

      const ai = getGeminiClient();
      const currentLang = lang || 'hinglish';
      const currentPersonality = personality || 'jarvis';

      // Construct detailed context of rearing conditions
      const temp = farmContext?.temp !== undefined ? farmContext.temp : 29.4;
      const humidity = farmContext?.humidity !== undefined ? farmContext.humidity : 64;
      const eggWeight = farmContext?.eggWeight !== undefined ? farmContext.eggWeight : 12.5;
      const larvaeWeight = farmContext?.larvaeWeight !== undefined ? farmContext.larvaeWeight : 25.0;
      const yieldRatio = farmContext?.yieldRatio !== undefined ? farmContext.yieldRatio : 2.0;
      const fcr = farmContext?.fcr !== undefined ? farmContext.fcr : 1.8;
      const activeAlerts = farmContext?.activeAlerts || [];
      const currentStage = farmContext?.currentStage || "Growing Larvae";

      const alertsStr = activeAlerts.length > 0 
        ? activeAlerts.map((a: any) => `${a.title}: ${a.msg}`).join("; ") 
        : "No active hazard alerts. Clean optimal parameters.";

      // Map personalities to detailed guiding descriptions
      let personalityDirective = "";
      if (currentPersonality === 'mentor') {
        personalityDirective = "Speak like a warm, encouraging, experienced elder farmer and mentor who cares of larvae health. Use supportive words, kind expressions, and explain biological facts with humble patience.";
      } else if (currentPersonality === 'energetic') {
        personalityDirective = "Speak with high enthusiasm, high optimism, and swift actionable excitement! You love BSF farming, and you want to hype up every metric, keeping spirits super high and proactive.";
      } else if (currentPersonality === 'scientific') {
        personalityDirective = "Speak like an ultra-professional, precise, biological research lab scholar. Use scientific words relating to FCR yields, climate density variables, biomass structures, and optimal substrate humidity.";
      } else {
        // default 'jarvis'
        personalityDirective = "Speak like Jarvis—a highly intelligent, futuristic, polite, slightly witty AI butler and advanced facility assistant. Use crisp, high-tech, reassuring terms.";
      }

      const systemPrompt = `You are FlyMind AI, a premium futuristic AI Voice Assistant Agent for BSF (Black Soldier Fly) farming. You act as an intelligent voice companion (Jarvis for BSF).
You have live, direct telemetry and biological access of the user's BSF colony:
- Temperature: ${temp}°C (Safe range: 28-32°C)
- Relative Humidity: ${humidity}% (Safe range: 60-70%)
- Average Egg Biomass: ${eggWeight}g
- Larvae Weight: ${larvaeWeight}g
- Feed Conversion Ratio (FCR): ${fcr}
- Core Output Yield Ratio: ${yieldRatio} kg/g
- Active alerts / concerns: ${alertsStr}
- Currently Scanned Lifecycle stage: ${currentStage}

USER INSTRUCTION OR VOICE TRANSCRIPT: "${message}"

ASSISTANT PERSONALITY SPEECH DIRECTIVE:
${personalityDirective}

LANGUAGES PREFERENCE (STRICT RULE):
- If user language preference is 'hi': Respond strictly in natural, emotional, clear Devanagari Hindi script. E.g. "तापमान अभी बिल्कुल सामान्य है। चिंता की कोई बात नहीं है।"
- If user language preference is 'hinglish': Respond strictly in easy conversational Hinglish (Hindi language written in English/Latin letters). NEVER use Hindi script in 'textSpeech' or 'textDisplay'.
  To keep speech fluid and human, interleave casual Hindi structures with English nouns exactly like a bilingual Indian supervisor:
  E.g., "Humidity abhi stable hai.", "Prepupa stage detect hua hai.", "Temperature thoda high hai."
- If user language preference is 'en': Respond strictly in professional, articulate English. E.g. "Humidity levels are currently stable."
The user selected language preference is currently: "${currentLang}"

BEHAVIOR RULES FOR CONVERSATIONAL GRAPH:
1. Provide extremely natural, conversational responses. Avoid starting speech with dry declarations or machine metadata strings (no "System alert level..."). Instead, express empathy or assurance first.
2. Keep the 'textSpeech' response concise (1-3 sentences maximum, 50 words ceiling), smooth, and completely free of any special formatting (no asterisks, no bullets, no markdown hash headers). It must read naturally as spoken speech, using commas and periods to denote calm, human pacing breath breaks.
3. The 'textDisplay' can contain visual-friendly markdown, clean bullet points, or slightly longer explanations for display on the assistant card.
4. If the user asks to open, view, or navigate to a section (e.g. "alerts dekhao", "go to tracker", "settings page", "open profile", "scan page", "main status"), identify the target page and set:
   - 'action' to "navigate"
   - 'targetTab' to one of: "home", "scan", "tracker", "alerts", "profile", "settings".
   Otherwise set action to "none" and targetTab to "none".

Respond STRICTLY in JSON format following this schema representation.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
               textSpeech: { 
                 type: Type.STRING, 
                 description: "Extremely concise spoken answer (1-3 sentences), natural conversational Hinglish/English/Hindi, strictly plain text without bullets/markdown." 
               },
               textDisplay: { 
                 type: Type.STRING, 
                 description: "Formatted markdown response to be displayed on the screen." 
               },
               action: { 
                 type: Type.STRING, 
                 description: "Action type: 'navigate' or 'none'" 
               },
               targetTab: { 
                 type: Type.STRING, 
                 description: "Must be one of: 'home', 'scan', 'tracker', 'alerts', 'profile', 'settings', or 'none'" 
               }
            },
            required: ["textSpeech", "textDisplay", "action", "targetTab"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response from Gemini voice assistant model.");
      }

      const result = JSON.parse(text);
      return res.json(result);

    } catch (error: any) {
      console.error("Voice Assistant Error:", error);
      return res.status(500).json({ error: error.message || "Internal Voice Processing Error" });
    }
  });

  // Real-time AI Vision-based BSF farming diagnostics
  app.post("/api/scan-biology", async (req, res) => {
    try {
      const { image, experienceLevel } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image content provided." });
      }

      // Handle programmatic vector SVG mock scans directly to bypass sending raw SVG strings to Gemini.
      // Gemini API only supports raster formats (JPEG/PNG/WebP) and base64-encoded binary buffers.
      if (typeof image === "string" && image.startsWith("data:image/svg+xml")) {
        const decodedSvg = decodeURIComponent(image);
        let status = "HEALTHY LARVAE 🟢";
        let identifiedObject = "Healthy BSF Larvae (Swasth Kide)";
        let detectedStage = "Growing Larvae";
        let nextStageTime = "Ready for Crawl-out in 4–6 days / ४-६ दिन में क्रॉल-आउट";
        let progressPercent = 50;
        let colorCode = "green";
        let conditionAnalysis = "Larvae look healthy, active movement is visible in the container feed.";
        let farmingAdvice = "Keep temperature around 27-30°C and maintain feed moisture levels.";
        let problem = "None";
        let possibleReason = "Ideal feed moisture and optimal surrounding climate.";
        let kyaKare = ["Maintain current feed moisture / नमी का ध्यान रखें", "Ensure tray is aerated / हवा की व्यवस्था रखें"];
        let kyaNaKare = ["Do not overheat the substrate / तापमान अधिक न बढ़ने दें", "Do not add acidic foods / खट्टा भोजन न डालें"];

        if (decodedSvg.includes("FUNGUS")) {
          status = "WARNING 🟡 - POSSIBLE FUNGUS";
          identifiedObject = "Larvae Substrate with Yellow/White Fungus Growth";
          detectedStage = "Growing Larvae";
          nextStageTime = "Breeding cycle delay of 3-5 days / प्रजनन में ३-५ दिन की देरी";
          progressPercent = 50;
          colorCode = "yellow";
          conditionAnalysis = "Fungus spore mold is growing on the top surface layer of feeding bed.";
          farmingAdvice = "Stir the bin substrate immediately to break mold crust, reduce moisture.";
          problem = "Substrate Fungus / फपूँदी";
          possibleReason = "Poor air circulation and high feed moisture (>80%).";
          kyaKare = ["Stir feed substrate to aerate / चारा हिलाएं", "Reduce ambient humidity / नमी घटाएं", "Harvest larvae early if damage spreads / संक्रमण बढ़ने पर जल्द हार्वेस्ट करें"];
          kyaNaKare = ["Do not add water helper sprays / पानी का छिड़काव न करें", "Do not dump high sugar waste / मीठा कचरा न डालें"];
        } else if (decodedSvg.includes("WET_FEED") || decodedSvg.includes("MOISTURE")) {
          status = "WARNING 🟡 - WET FEED";
          identifiedObject = "BSF Wet Substrate / अत्यधिक गीला चारा";
          detectedStage = "Growing Larvae";
          nextStageTime = "Maturity delayed by 4 days / ४ दिन विकास चक्र की देरी";
          progressPercent = 50;
          colorCode = "yellow";
          conditionAnalysis = "Substrate shows liquid accumulation. Larvae are climbing walls to escape anaerobic conditions.";
          farmingAdvice = "Add dry wheat bran, chick feed, or dry coconut coir immediately.";
          problem = "Excess Feed Moisture / गीलापन";
          possibleReason = "Over-feeding with high water-content kitchen waste.";
          kyaKare = ["Add dry kitchen absorbent or wheat bran / सूखा चोकर या भूसी मिलाएं", "Improve container drainage / निकास सुधारें", "Increase warmth/ventilation / वेंटिलेशन बढ़ाएं"];
          kyaNaKare = ["Do not feed wet pureed fruits / अत्यधिक गीले फल न दें", "Do not seal the lids tight / ढक्कन पूरी तरह बंद न करें"];
        } else if (decodedSvg.includes("CRUSTY_DRY")) {
          status = "WARNING 🟡 - DRY FEED";
          identifiedObject = "Dry BSF Breeding Substrate / सूखा चारा";
          detectedStage = "Growing Larvae";
          nextStageTime = "Wasted growth for 5-7 days / ५-७ दिन चक्र देरी";
          progressPercent = 50;
          colorCode = "yellow";
          conditionAnalysis = "Feed has dried up into a hard crust. Tiny growing larvae cannot chew or digest dry cakes.";
          farmingAdvice = "Incorporate light water mist spray or freshly chopped melon scraps.";
          problem = "Substrate Dehydration / सूखा चारा";
          possibleReason = "High incubator fan draft or insufficient biological moisture addition.";
          kyaKare = ["Spray warm water mist over beds / गुनगुने पानी की भाप छिड़कें", "Feed wet fruit pulp / रसीदार फल का कचरा दें", "Cover trays with loose cardboard sheets / गत्ते की ढीली शीट से ढकें"];
          kyaNaKare = ["Do not dump dry cardboard / सूखा ठोस गत्ता न डालें", "Do not keep fan speed high / पंखे की रफ़्तार तेज न रखें"];
        } else if (decodedSvg.includes("DENSITY") || decodedSvg.includes("CROWD")) {
          status = "DANGER 🔴 - OVERCROWDING";
          identifiedObject = "Overcrowded Larval Bedding / घनी आबादी";
          detectedStage = "Growing Larvae";
          nextStageTime = "High mortality risk within 48h / ४८ घंटे में खतरनाक मृत्यु दर";
          progressPercent = 50;
          colorCode = "orange";
          conditionAnalysis = "Substrate is literally boiling with larvae. Aggressive friction is generating heavy metabolic heat.";
          farmingAdvice = "Partition the active larvae population over 2 or 3 supplementary empty nursery trays.";
          problem = "Overpopulation Density / अत्यधिक जनसंख्या";
          possibleReason = "Too many egg-grafts hatched in a single nursery tray region.";
          kyaKare = ["Split biomass into dual trays / आबादी को दो भागों में बांटें", "Increase cold ventilation / हवा का प्रवाह बढ़ाएं", "Add thick high-fiber feed / सूखा और उच्च फाइबर का चारा दें"];
          kyaNaKare = ["Do not add high nitrogen feeds / अधिक नाइट्रोजन वाला भोजन न डालें", "Do not pile larvae multi-deep / कीड़ों की मोटी परत न जमा होने दें"];
        } else if (decodedSvg.includes("DEAD") || decodedSvg.includes("DECAY")) {
          status = "DANGER 🔴 - DEAD LARVAE";
          identifiedObject = "Rotting Substrate & Dead BSF / मृत कीड़े";
          detectedStage = "Growing Larvae";
          nextStageTime = "Stalled Cycle / विकास चक्र रुक गया है";
          progressPercent = 50;
          colorCode = "dark";
          conditionAnalysis = "Widespread blackening of larval bodies, absolutely zero movement. Intense ammonia odor.";
          farmingAdvice = "Discard infected tray substrates immediately. Sanitize incubator rows with hydrogen peroxide.";
          problem = "Mass Larvae Mortality / सामूहिक मृत्यु दर";
          possibleReason = "Pathogen overload, high heavy metal toxicities, or temp spike above 45°C.";
          kyaKare = ["Isolate infected trays / संक्रमित ट्रे अलग करें", "Sanitize the entire rack / पूरे रैक को कीटाणुरहित करें", "Review chemical contamination in food / भोजन में रासायनिक दूषण की जाँच करें"];
          kyaNaKare = ["Do not recycle dead larval waste / मृत कीड़ों को दोबारा उपयोग न करें", "Do not feed raw leftovers / अनियंत्रित बचा हुआ खाना न दें"];
        } else if (decodedSvg.includes("PREPUPAE") || decodedSvg.includes("PUPA")) {
          status = "READY FOR HARVEST 🟢";
          identifiedObject = "Mature Prepupae Crawlers / प्री-प्यूपा";
          detectedStage = "Prepupa";
          nextStageTime = "Pupating within 3-4 days / ३-४ दिन में प्यूपा बनेंगे";
          progressPercent = 85;
          colorCode = "orange";
          conditionAnalysis = "Uniform dark brown and black bodies. Larvae have emptied digestive systems to begin pre-pupation.";
          farmingAdvice = "Activate self-harvesting crawl-out ramps leading to collectors dry sandbox.";
          problem = "None - Peak Harvest Quality";
          possibleReason = "Ideal feed cycle nutrition successfully completed.";
          kyaKare = ["Provide dry sandbox collectors / सूखे रेत के संग्रह कंटेनर दें", "Maintain dim red-light background / मंद लाल रोशनी की व्यवस्था रखें", "Control ambient humidity at 60% / आर्द्रता ६०% पर रखें"];
          kyaNaKare = ["Do not pour more fresh feed wet sludge / ताजा गीला चारा डालना बंद करें", "Do not keep trays exposed to heavy sunlight / सीधे धूप में ट्रे न छोड़ें"];
        } else if (decodedSvg.includes("UNCLEAR") || decodedSvg.includes("BLURRY")) {
          status = "UNCLEAR IMAGE ⚪";
          identifiedObject = "Blurry scan background";
          detectedStage = "Uncertain";
          nextStageTime = "Uncertain";
          progressPercent = 0;
          colorCode = "gray";
          conditionAnalysis = "Camera scan could not find sharp larval outlines.";
          farmingAdvice = "Please hold camera extremely steady directly above the BSF tray, turn on flash.";
          problem = "Blurry / Low Lighting Scan / धुंधला चित्र";
          possibleReason = "Unsteady device or dirty camera glass.";
          kyaKare = ["Sanitize lens glass / लैंस साफ करें", "Scan with active tray flash on / फ़्लैश चालू करके स्कैन करें", "Keep camera 8 inches away / कैमरा ८ इंच दूर रखें"];
          kyaNaKare = ["Do not scan in dark room / अँधेरे कमरे में स्कैन न करें", "Do not shake device during capture / डिवाइस को हिलाएं नहीं"];
        } else if (decodedSvg.includes("UNCERTAIN")) {
          status = "UNCERTAIN DETECT ⚪";
          identifiedObject = "Unknown non-BSF target";
          detectedStage = "Uncertain";
          nextStageTime = "Uncertain";
          progressPercent = 0;
          colorCode = "gray";
          conditionAnalysis = "Recognized object does not look like BSF colonies or eggs.";
          farmingAdvice = "Ensure you are scanning actual BSF feed bins, rearing cages, or oviposition boards.";
          problem = "Non-BSF Target scanned";
          possibleReason = "Camera focused on empty concrete floor, wood pallets or hands.";
          kyaKare = ["Focus directly on BSF larvae trays / सीधे कीड़ों की ट्रे पर फोकस करें", "Use high-contrast focus grids / ग्रिड लाइनों की मदद लें", "Keep light even across the feed / रोशनी एक सामान रखें"];
          kyaNaKare = ["Do not scan outer wall / दीवार का चित्र न लें", "Do not scan empty white papers / खाली कागज का चित्र न लें"];
        } else if (decodedSvg.includes("LCD") || decodedSvg.includes("rH")) {
          status = "HEALTHY LARVAE 🟢";
          identifiedObject = "Optimal BSF Incubation Environment";
          detectedStage = "Growing Larvae";
          nextStageTime = "Matures in 12 days / १२ दिन में तैयार";
          progressPercent = 50;
          colorCode = "green";
          conditionAnalysis = "Stable thermal-humidity limits. Excellent metabolic feeding parameters.";
          farmingAdvice = "Maintain current automated sprayers and heat pad boundaries.";
          problem = "None";
          possibleReason = "Climate control boundaries fully respected.";
          kyaKare = ["Keep monitoring sensor updates", "Ensure vent fans run on timer"];
          kyaNaKare = ["Do not block the air inlets", "Do not let soil dry completely"];
        }

        const fallbackResponse = {
          status,
          identifiedObject,
          detectedStage,
          nextStageTime,
          progressPercent,
          colorCode,
          conditionAnalysis,
          farmingAdvice,
          problem,
          possibleReason,
          kyaKare,
          kyaNaKare,
          en: {
            status,
            identifiedObject,
            detectedStage,
            nextStageTime,
            conditionAnalysis,
            farmingAdvice,
            problem,
            possibleReason,
            kyaKare,
            kyaNaKare
          }
        };
        return res.json(fallbackResponse);
      }

      // Parse base64 parts
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      let mimeType = "image/jpeg";
      let base64Data = image;

      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }

      const ai = getGeminiClient();

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      };

      let levelPrompt = "Provide highly intelligent, standard professional agronomic insights.";
      if (experienceLevel === "Beginner Farmer") {
        levelPrompt = `The user is a BEGINNER FARMER:
- Keep explanations extremely simple, helpful, and friendly. Use analogies instead of scientific jargon.
- Avoid advanced technical terms or complex organic calculations.
- Use simple terms (e.g., 'larvae food' instead of 'organic feeding substrates', 'baby worms' instead of 'instars').
- Focus on basic, easy-to-follow actions and motivational advice.`;
      } else if (experienceLevel === "Intermediate Farmer") {
        levelPrompt = `The user is an INTERMEDIATE FARMER:
- Keep information clear, straightforward, and moderately detailed.
- Talk about standard larval parameters and basic diagnostic indicators.
- Provide practical troubleshooting steps and baseline climate metrics.`;
      } else if (experienceLevel === "Advanced Farmer") {
        levelPrompt = `The user is an ADVANCED FARMER:
- Provide highly detailed analysis, specific environmental parameters, and advanced tracking factors.
- Highlight proactive pathogen prevention, biological health assessments, and micro-climate stability.`;
      } else if (experienceLevel === "Professional BSF Farmer") {
        levelPrompt = `The user is a PROFESSIONAL BSF FARMER:
- Provide top-tier expert-grade intelligence, dense scientific insights, and industrial rearing metrics.
- Focus on Feed Conversion Ratio (FCR), biological density limits, biosecurity protocols, automated humidity controls, and yield maximization.
- Keep recommendations strictly professional, precise, and expert-grade.`;
      }

      const textPart = {
        text: `You are FlyMind AI, an intelligent BSF (Black Soldier Fly) biology and lifecycle analyzer.
Look at the uploaded image and detect the current BSF lifecycle stage.
Avoid fake scientific complexity. Answer in conversational, friendly Hindi/English (Hinglish/Hindi & clean English).

${levelPrompt}

LIFECYCLE STAGES TO CHOOSE FROM:
1. BSF Eggs (🥚 Small pale-creamy clusters in crevices or on logs)
2. Newly Hatched Larvae (🌱 Tiny transparent neonates, 1-4 days old, barely visible or highly dense)
3. Growing Larvae (🐛 Active, creamy-yellow middle-instar larvae swimming or crawling in feed)
4. Mature Larvae (🪵 Fat, creamy-white or light brown L6 larvae, thick body but fast crawling)
5. Prepupa (🤎 Dark brown crawlers starting to leave the wet feed in search of dry areas)
6. Pupa (🖤 Hard, stiff, pure black or dark segmented capsule, completely immobile/inactive)
7. Adult Black Soldier Fly (🪰 Winged wasp-like blue-black fly walking or mating)

ANALYSIS INSTRUCTIONS:
- Analyze color, size, texture, and maturity appearance to determine the correct stage.
- If the image is unclear, blurry, or does not contain BSF-related elements, set:
  - detectedStage = "Uncertain"
  - status = "Exact lifecycle stage fully clear nahi hai. ⚪"
  - problem = "Exact lifecycle stage fully clear nahi hai."
- If Eggs: Provide estimated hatch time and humidity advice.
- If Larvae (Newly Hatched, Growing, Mature): Provide growth condition and feed recommendations.
- If Prepupa / Pupa: Provide estimated adult emergence time and harvest readiness.
- If Adult BSF: Provide breeding condition and egg-laying possibility.

Your response must map to the schema. Keep advice conversational, scannable, and extremely practical for a BSF farmer. Do not repeat identical answers.`,
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: {
                type: Type.STRING,
                description: "Color-coded status with emoji, matching one of: HEALTHY LARVAE 🟢, WARNING 🟡 - POSSIBLE FUNGUS, WARNING 🟡 - WET FEED, WARNING 🟡 - DRY FEED, DANGER 🔴 - OVERCROWDING, DANGER 🔴 - DEAD LARVAE, READY FOR HARVEST 🟢, INFO 🔵 - BSF EGGS (ANDE), INFO 🔵 - ADULT FLIES (MAKKHI), DANGER 🔴 - MOLD OUTBREAK, INFO 🔵 - BSF FRASS (RESIDUE), WARNING 🟡 - DRY LARVAE, DANGER 🔴 - OVERHEATING SIGNS, UNCLEAR IMAGE ⚪, UNCERTAIN DETECT ⚪. If stage detected, use a friendly label including stage name."
              },
              identifiedObject: { type: Type.STRING, description: "Identified object description in Hinglish" },
              detectedStage: {
                type: Type.STRING,
                description: "Must be exactly one of: BSF Eggs, Newly Hatched Larvae, Growing Larvae, Mature Larvae, Prepupa, Pupa, Adult Black Soldier Fly, Uncertain"
              },
              nextStageTime: {
                type: Type.STRING,
                description: "Estimated time to reach the next stage, e.g., 'Hatching in 3–4 days / ३-४ दिन में अंडे फूटेंगे' or 'Emergence in 10-14 days / १०-१४ दिन में मक्खियां निकलेंगी'"
              },
              progressPercent: {
                type: Type.INTEGER,
                description: "Progress percentage of the BSF lifecycle: Eggs = 15, Newly Hatched = 30, Growing Larvae = 50, Mature Larvae = 70, Prepupa = 85, Pupa = 92, Adult Black Soldier Fly = 100, Uncertain = 0"
              },
              colorCode: {
                type: Type.STRING,
                description: "Representing stage status color: green, blue, yellow, orange, dark, purple, gray"
              },
              conditionAnalysis: { type: Type.STRING, description: "Simple status/condition observation of the culture" },
              farmingAdvice: { type: Type.STRING, description: "Key action advice for this lifecycle stage" },
              problem: { type: Type.STRING },
              possibleReason: { type: Type.STRING },
              kyaKare: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Actionable Hinglish step-by-step 'What To Do' items"
              },
              kyaNaKare: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Avoidable Hinglish step-by-step 'What Not To Do' items"
              },
              en: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  identifiedObject: { type: Type.STRING },
                  detectedStage: { type: Type.STRING },
                  nextStageTime: { type: Type.STRING },
                  conditionAnalysis: { type: Type.STRING },
                  farmingAdvice: { type: Type.STRING },
                  problem: { type: Type.STRING },
                  possibleReason: { type: Type.STRING },
                  kyaKare: { type: Type.ARRAY, items: { type: Type.STRING } },
                  kyaNaKare: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["status", "identifiedObject", "detectedStage", "nextStageTime", "conditionAnalysis", "farmingAdvice", "problem", "possibleReason", "kyaKare", "kyaNaKare"]
              },
              hi: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  identifiedObject: { type: Type.STRING },
                  detectedStage: { type: Type.STRING },
                  nextStageTime: { type: Type.STRING },
                  conditionAnalysis: { type: Type.STRING },
                  farmingAdvice: { type: Type.STRING },
                  problem: { type: Type.STRING },
                  possibleReason: { type: Type.STRING },
                  kyaKare: { type: Type.ARRAY, items: { type: Type.STRING } },
                  kyaNaKare: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["status", "identifiedObject", "detectedStage", "nextStageTime", "conditionAnalysis", "farmingAdvice", "problem", "possibleReason", "kyaKare", "kyaNaKare"]
              }
            },
            required: ["status", "identifiedObject", "detectedStage", "nextStageTime", "progressPercent", "colorCode", "conditionAnalysis", "farmingAdvice", "problem", "possibleReason", "kyaKare", "kyaNaKare", "en", "hi"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from Gemini model.");
      }

      const payload = JSON.parse(text);
      return res.json(payload);

    } catch (error: any) {
      console.error("Gemini Scan Error:", error);
      return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
