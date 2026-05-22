const GEMINI_MODEL = "gemini-2.5-flash"
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

async function getAiAnswer(question, answers, apiKey) {
  if (!apiKey) {
    console.error("Error: Gemini API Key not provided to getAiAnswer.")
    return "Error: Gemini API Key not available. Please set it in the extension popup."
  }

  let prompt = `Given the following multiple-choice question and its possible answers, please choose the best answer(s).
If the question implies multiple correct answers (e.g., 'select all that apply', 'choose N correct options'), return ALL chosen answer texts, each on a new line.
Otherwise, if it's a single-choice question, return only the text of the single best chosen answer option.
Do not add any extra explanation or leading text like "The best answer is: ".

Question:
${question}

Possible Answers:
`
  answers.forEach((ans, i) => {
    prompt += `${i + 1}. ${ans}\n`
  })

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Gemini API Error:", errorData)
      return `Error calling Gemini API: ${response.status} ${response.statusText}. Check console. Key might be invalid or quota exceeded.`
    }

    const data = await response.json()
    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      return data.candidates[0].content.parts[0].text.trim()
    } else {
      console.error("Unexpected response structure from Gemini API:", data)
      return "Error: Could not extract answer from Gemini response structure."
    }
  } catch (error) {
    console.error("Error fetching from Gemini API:", error)
    return "Error connecting to Gemini API. Check console for details."
  }
}

async function getAiMatching(question, itemTexts, optionPool, apiKey) {
  if (!apiKey) {
    return { error: "Error: Gemini API Key not available." }
  }
  if (!itemTexts || itemTexts.length === 0) {
    return { error: "Error: no items provided to getAiMatching." }
  }

  const prompt =
    "You are given a matching question. Pair EACH item with the option that best matches it.\n" +
    "Return ONLY a valid JSON object whose keys are the exact item texts (verbatim) and whose values are the exact option texts (verbatim). " +
    "No prose, no markdown fences, no extra fields.\n\n" +
    `Question:\n${question}\n\n` +
    `Items:\n${itemTexts.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n` +
    `Options pool (each option may be used at most once unless the question says otherwise):\n${optionPool.map((t, i) => `${i + 1}. ${t}`).join("\n")}`

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Gemini API Matching Error:", errorData)
      return {
        error: `Error calling Gemini API: ${response.status} ${response.statusText}.`,
      }
    }

    const data = await response.json()
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!txt) {
      console.error("Gemini API Matching: empty response.", data)
      return { error: "Error: empty AI response for matching." }
    }
    try {
      const obj = JSON.parse(txt)
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return { mapping: obj }
      }
      return { error: "Error: matching response is not a JSON object." }
    } catch (e) {
      console.error("Gemini API Matching: JSON parse failure.", txt, e)
      return { error: "Error: failed to parse matching JSON. Raw: " + txt }
    }
  } catch (error) {
    console.error("Error fetching from Gemini API for matching:", error)
    return { error: "Error connecting to Gemini API for matching." }
  }
}

async function getAiFillBlanks(sentence, blanks, apiKey) {
  if (!apiKey) {
    return { error: "Error: Gemini API Key not available." }
  }
  if (!blanks || blanks.length === 0) {
    return { error: "Error: no blanks provided to getAiFillBlanks." }
  }

  const prompt =
    "You are given a fill-in-the-blanks question. Each blank is numbered with ___[N] inside the sentence.\n" +
    "For each blank, pick the option from its provided list that best completes the sentence.\n" +
    "Return ONLY a valid JSON array of strings, one per blank, in order, each the exact verbatim option text. No prose, no markdown fences.\n\n" +
    `Sentence:\n${sentence}\n\nBlanks:\n` +
    blanks
      .map((b, i) => `${i + 1}. Options: ${b.optionTexts.join(", ")}`)
      .join("\n")

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("Gemini API Fillblanks Error:", errorData)
      return {
        error: `Error calling Gemini API: ${response.status} ${response.statusText}.`,
      }
    }

    const data = await response.json()
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!txt) {
      return { error: "Error: empty AI response for fillblanks." }
    }
    try {
      const arr = JSON.parse(txt)
      if (Array.isArray(arr) && arr.every((s) => typeof s === "string")) {
        return { answers: arr }
      }
      return { error: "Error: fillblanks response not an array of strings." }
    } catch (e) {
      console.error("Gemini API Fillblanks: JSON parse failure.", txt, e)
      return { error: "Error: failed to parse fillblanks JSON. Raw: " + txt }
    }
  } catch (error) {
    console.error("Error fetching from Gemini API for fillblanks:", error)
    return { error: "Error connecting to Gemini API for fillblanks." }
  }
}

async function getAiAnswersForBatch(questionsDataArray, apiKey) {
  if (!apiKey) {
    console.error("Error: Gemini API Key not provided to getAiAnswersForBatch.")
    return {
      error:
        "Error: Gemini API Key not available. Please set it in the extension popup.",
    }
  }
  if (!questionsDataArray || questionsDataArray.length === 0) {
    console.debug("getAiAnswersForBatch: No questions provided.")
    return { answers: [] }
  }

  let prompt =
    "You will be provided with a JSON array of multiple-choice questions. For each question, choose the best answer(s) from its 'Possible Answers'.\n"
  prompt +=
    "If a question implies multiple correct answers (e.g., 'select all that apply', 'choose N correct options'), include all correct answer texts for that question concatenated into a single string, separated by ' /// ' (space, three forward slashes, space). Example: 'Answer A /// Answer C'.\n"
  prompt +=
    "Otherwise, if it's a single-choice question, return just the single best answer text as the string for that question.\n"
  prompt +=
    "Return a single JSON array of strings, where each string is the processed answer for the corresponding question in the input array. Do not add any extra explanation or leading/trailing text.\n"
  prompt +=
    'For example, if the input is two questions (Q1 single-choice, Q2 multi-choice requiring two answers), your output should be a JSON array like: ["Text of answer for Q1", "Text of answer A for Q2 /// Text of answer B for Q2"].\n\n'
  prompt += "Here are the questions:\n```json\n"

  const questionsForPrompt = questionsDataArray.map((q, index) => ({
    id: `question_${index + 1}`,
    question_text: q.question,
    possible_answers: q.answers,
  }))

  prompt += JSON.stringify(questionsForPrompt, null, 2)
  prompt += "\n```"

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Gemini API Batch Error (response.ok false):", errorData)
      return {
        error: `Error calling Gemini API: ${response.status} ${
          response.statusText
        }. Details: ${JSON.stringify(errorData)}`,
      }
    }

    const data = await response.json()

    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      const rawResponseText = data.candidates[0].content.parts[0].text
      console.debug("Gemini API Batch Raw Response Text:", rawResponseText)
      try {
        const parsedAnswers = JSON.parse(rawResponseText)
        if (
          Array.isArray(parsedAnswers) &&
          parsedAnswers.every((ans) => typeof ans === "string")
        ) {
          if (parsedAnswers.length === questionsDataArray.length) {
            return { answers: parsedAnswers }
          } else {
            console.error(
              "Gemini API Batch Error: Number of answers received does not match number of questions sent.",
              parsedAnswers,
            )
            return {
              error: "Error: Mismatch in number of answers from AI.",
              answers: parsedAnswers,
            }
          }
        } else {
          console.error(
            "Gemini API Batch Error: Response is not a JSON array of strings.",
            parsedAnswers,
          )
          return {
            error:
              "Error: AI response was not a valid JSON array of answer strings.",
          }
        }
      } catch (e) {
        console.error(
          "Gemini API Batch Error: Failed to parse AI response as JSON.",
          rawResponseText,
          e,
        )
        return {
          error:
            "Error: Could not parse AI response for batch. Raw: " +
            rawResponseText,
        }
      }
    } else {
      console.error(
        "Unexpected response structure from Gemini API for batch:",
        data,
      )
      return {
        error:
          "Error: Could not extract answers from Gemini batch response structure.",
      }
    }
  } catch (error) {
    console.error("Error fetching from Gemini API for batch:", error)
    return {
      error: "Error connecting to Gemini API for batch. Check console.",
    }
  }
}
