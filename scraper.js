// Constants for retry mechanism
const MAX_SCRAPE_ATTEMPTS = 10
const SCRAPE_RETRY_DELAY_MS = 1500

function _isQuestionVisible(el) {
  if (!el) return false
  // Walk up across shadow boundaries; if any host has zero box, it's hidden.
  let node = el
  while (node) {
    if (node.getBoundingClientRect) {
      const r = node.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return false
    }
    const root = node.getRootNode && node.getRootNode()
    if (root instanceof ShadowRoot) {
      node = root.host
    } else {
      node = node.parentElement
      if (node === document.body || node === document.documentElement || !node)
        break
    }
  }
  return true
}

async function scrapeData(currentAttempt = 1) {
  console.debug(
    `NetAcad Scraper (scraper.js): scrapeData attempt #${currentAttempt} of ${MAX_SCRAPE_ATTEMPTS}`,
  )

  const storedData = await chrome.storage.sync.get(["geminiApiKey"])
  const apiKey = storedData.geminiApiKey

  let mcqViewElements = []
  let matchingViewElements = []
  let fillblanksViewElements = []
  let objectMatchingViewElements = []
  let earlyExitReason = ""

  try {
    const appRoot = document.querySelector("app-root")
    if (appRoot && appRoot.shadowRoot) {
      const pageView = appRoot.shadowRoot.querySelector("page-view")
      if (pageView && pageView.shadowRoot) {
        const articleViews =
          pageView.shadowRoot.querySelectorAll("article-view")
        if (articleViews && articleViews.length > 0) {
          articleViews.forEach((articleView, i) => {
            if (articleView.shadowRoot) {
              const blockViews =
                articleView.shadowRoot.querySelectorAll("block-view")
              blockViews.forEach((blockView, j) => {
                if (blockView.shadowRoot) {
                  const mcqView = blockView.shadowRoot.querySelector("mcq-view")
                  if (mcqView) mcqViewElements.push(mcqView)
                  const matchingView =
                    blockView.shadowRoot.querySelector("matching-view")
                  if (matchingView) matchingViewElements.push(matchingView)
                  const fillblanksView =
                    blockView.shadowRoot.querySelector("fillblanks-view")
                  if (fillblanksView)
                    fillblanksViewElements.push(fillblanksView)
                  const objectMatchingView = blockView.shadowRoot.querySelector(
                    "object-matching-view",
                  )
                  if (objectMatchingView)
                    objectMatchingViewElements.push(objectMatchingView)
                }
              })
            }
          })
          if (
            mcqViewElements.length === 0 &&
            matchingViewElements.length === 0 &&
            fillblanksViewElements.length === 0 &&
            objectMatchingViewElements.length === 0
          )
            earlyExitReason =
              "Found article-view(s) but no question elements (mcq/matching/fillblanks/object-matching)."
        } else
          earlyExitReason = "page-view found, but no article-view elements."
      } else
        earlyExitReason = appRoot.shadowRoot.querySelector("page-view")
          ? "page-view found, but no shadowRoot."
          : "page-view not found in app-root."
    } else
      earlyExitReason = document.querySelector("app-root")
        ? "app-root found, but no shadowRoot."
        : "app-root not found."
  } catch (e) {
    earlyExitReason = "Exception during shadow DOM traversal."
    console.error(`NetAcad Scraper (scraper.js): ${earlyExitReason}`, e)
  }

  if (currentAttempt === 1) {
    document
      .querySelectorAll(".netacad-ai-assistant-ui[id^='netacad-ai-q-']")
      .forEach((el) => el.remove())
    mcqViewElements.forEach((mcqView) => {
      if (mcqView && mcqView.shadowRoot) {
        mcqView.shadowRoot
          .querySelectorAll(".netacad-ai-assistant-ui[id^='netacad-ai-q-']")
          .forEach((el) => el.remove())
      }
    })
  }

  if (
    mcqViewElements.length === 0 &&
    matchingViewElements.length === 0 &&
    fillblanksViewElements.length === 0 &&
    objectMatchingViewElements.length === 0
  ) {
    let logMessage = `NetAcad Scraper (scraper.js): Attempt #${currentAttempt}: No question elements found.`
    if (earlyExitReason) logMessage += ` Reason: ${earlyExitReason}`
    else if (currentAttempt === 1)
      logMessage += ` Shadow DOM traversal completed, but no mcq-view tags were identified.`
    console.debug(logMessage)

    if (currentAttempt < MAX_SCRAPE_ATTEMPTS) {
      console.debug(
        `NetAcad Scraper (scraper.js): Will retry in ${SCRAPE_RETRY_DELAY_MS / 1000}s...`,
      )
      setTimeout(() => {
        window.scrapeData && window.scrapeData(currentAttempt + 1)
      }, SCRAPE_RETRY_DELAY_MS)
      return false
    }
    console.warn(
      `NetAcad Scraper (scraper.js): Max retry attempts reached. Failed to find question elements.`,
    )
    return false
  }

  // Filter to currently-visible questions only. NetAcad keeps all questions in the DOM
  // and toggles visibility; processing hidden ones wastes API calls and time.
  const totalFound =
    mcqViewElements.length +
    matchingViewElements.length +
    fillblanksViewElements.length +
    objectMatchingViewElements.length
  mcqViewElements = mcqViewElements.filter(_isQuestionVisible)
  matchingViewElements = matchingViewElements.filter(_isQuestionVisible)
  fillblanksViewElements = fillblanksViewElements.filter(_isQuestionVisible)
  objectMatchingViewElements =
    objectMatchingViewElements.filter(_isQuestionVisible)
  const totalVisible =
    mcqViewElements.length +
    matchingViewElements.length +
    fillblanksViewElements.length +
    objectMatchingViewElements.length

  console.log(
    `NetAcad Scraper: visible ${mcqViewElements.length} mcq + ${matchingViewElements.length} matching + ${fillblanksViewElements.length} fillblanks + ${objectMatchingViewElements.length} objMatching (filtered ${totalFound - totalVisible} hidden).`,
  )

  if (totalVisible === 0) {
    if (currentAttempt < MAX_SCRAPE_ATTEMPTS) {
      setTimeout(() => {
        window.scrapeData && window.scrapeData(currentAttempt + 1)
      }, SCRAPE_RETRY_DELAY_MS)
    }
    return false
  }

  // Process matching questions independently (single-shot per question).
  if (matchingViewElements.length > 0) {
    if (typeof processSingleMatchingQuestion !== "function") {
      console.error(
        "NetAcad Scraper (scraper.js): processSingleMatchingQuestion not available.",
      )
    } else {
      for (const [mIdx, mv] of matchingViewElements.entries()) {
        try {
          await processSingleMatchingQuestion(mv, mIdx, apiKey)
        } catch (e) {
          console.error(
            `NetAcad Scraper (scraper.js): matching processing failed for Q${mIdx + 1}:`,
            e,
          )
        }
      }
    }
  }

  // Process object-matching questions — answers are encoded in `data-id` attributes,
  // so this is a purely-local pass (no AI / network).
  if (objectMatchingViewElements.length > 0) {
    if (typeof processSingleObjectMatchingQuestion !== "function") {
      console.error(
        "NetAcad Scraper (scraper.js): processSingleObjectMatchingQuestion not available.",
      )
    } else {
      for (const [oIdx, ov] of objectMatchingViewElements.entries()) {
        try {
          processSingleObjectMatchingQuestion(ov, oIdx)
        } catch (e) {
          console.error(
            `NetAcad Scraper (scraper.js): objectMatching failed for Q${oIdx + 1}:`,
            e,
          )
        }
      }
    }
  }

  // Process fill-in-the-blanks questions independently.
  if (fillblanksViewElements.length > 0) {
    if (typeof processSingleFillBlanksQuestion !== "function") {
      console.error(
        "NetAcad Scraper (scraper.js): processSingleFillBlanksQuestion not available.",
      )
    } else {
      for (const [fIdx, fv] of fillblanksViewElements.entries()) {
        try {
          await processSingleFillBlanksQuestion(fv, fIdx, apiKey)
        } catch (e) {
          console.error(
            `NetAcad Scraper (scraper.js): fillblanks processing failed for Q${fIdx + 1}:`,
            e,
          )
        }
      }
    }
  }

  if (mcqViewElements.length === 0) {
    // No MCQs to batch; matching is already handled above.
    return true
  }

  if (!apiKey) {
    console.warn(
      "NetAcad Scraper (scraper.js): Gemini API Key not found. Displaying message in UI.",
    )
    for (const [index, mcqViewElement] of mcqViewElements.entries()) {
      // The third argument to processSingleQuestion is apiKey, the fourth is preFetchedAiAnswer
      await processSingleQuestion(
        mcqViewElement,
        index,
        null,
        "Error: Gemini API Key not set in popup.",
      )
    }
    return true // Processed (by showing error)
  }

  // Tier 1: local answer DB. Tier 2: itexamanswers.net online search. Tier 3: Gemini batch.
  const remainingMcqViews = []
  let localHits = 0
  let onlineHits = 0
  for (const [index, mcqViewElement] of mcqViewElements.entries()) {
    if (typeof extractQuestionAndAnswers !== "function") {
      remainingMcqViews.push([index, mcqViewElement])
      continue
    }
    const { questionText } = extractQuestionAndAnswers(mcqViewElement, index)

    if (typeof findLocalAnswers === "function") {
      const local = findLocalAnswers(questionText)
      if (local && local.length > 0) {
        await processSingleQuestion(
          mcqViewElement,
          index,
          apiKey,
          local.join(" /// "),
        )
        localHits++
        continue
      }
    }
    if (typeof findOnlineAnswers === "function") {
      const online = await findOnlineAnswers(questionText)
      if (online && online.length > 0) {
        await processSingleQuestion(
          mcqViewElement,
          index,
          apiKey,
          online.join(" /// "),
        )
        onlineHits++
        continue
      }
    }
    remainingMcqViews.push([index, mcqViewElement])
  }
  if (localHits + onlineHits > 0 || remainingMcqViews.length > 0) {
    console.log(
      `NetAcad Scraper: ${localHits} local + ${onlineHits} itexamanswers hits; ${remainingMcqViews.length} remaining for AI.`,
    )
  }
  if (remainingMcqViews.length === 0) return true

  const allQuestionsData = []
  for (const [index, mcqViewElement] of remainingMcqViews) {
    // extractQuestionAndAnswers is in ui.js and should be globally available.
    // It returns { questionText, answerElements, questionTextElement }
    if (typeof extractQuestionAndAnswers !== "function") {
      console.error(
        "NetAcad Scraper (scraper.js): extractQuestionAndAnswers function is not available!",
      )
      // Fallback: process each question individually with an error message, or just skip UI update
      await processSingleQuestion(
        mcqViewElement,
        index,
        apiKey,
        "Error: Core UI function (extract) missing.",
      )
      continue
    }
    const extractionResult = extractQuestionAndAnswers(mcqViewElement, index)
    const answerTexts = processAnswerElements(
      extractionResult.answerElements,
      index,
    )

    if (
      extractionResult.questionText &&
      !extractionResult.questionText.startsWith("Error") &&
      answerTexts.length > 0
    ) {
      allQuestionsData.push({
        question: extractionResult.questionText,
        answers: answerTexts,
        mcqViewElement: mcqViewElement,
        originalIndex: index,
        questionTextElement: extractionResult.questionTextElement, // Needed for UI injection by processSingleQuestion
      })
    } else {
      // If extraction fails for a question, still call processSingleQuestion to render its UI with the error.
      // The error from extractionResult.questionText or lack of answers will be handled by processSingleQuestion.
      console.warn(
        `NetAcad Scraper (scraper.js): Failed to extract valid Q&A for question ${index + 1}. Will let processSingleQuestion handle UI error.`,
      )
      await processSingleQuestion(
        mcqViewElement,
        index,
        apiKey,
        extractionResult.questionText,
      ) // Pass the extraction error
    }
  }

  if (allQuestionsData.length > 0) {
    console.debug(
      `NetAcad Scraper (scraper.js): Extracted ${allQuestionsData.length} valid questions for batch API call.`,
    )
    const questionsForBatchApi = allQuestionsData.map((q) => ({
      question: q.question,
      answers: q.answers,
    }))

    // Call processSingleQuestion for each item to set up initial UI (e.g., "Processing batch...")
    // BEFORE making the batch API call.
    for (const questionData of allQuestionsData) {
      // Pass a specific message to indicate batch processing is starting
      // processSingleQuestion will need to handle this initial state message.
      await processSingleQuestion(
        questionData.mcqViewElement,
        questionData.originalIndex,
        apiKey,
        "BATCH_PROCESSING_STARTED",
      )
    }

    const batchApiResponse = await getAiAnswersForBatch(
      questionsForBatchApi,
      apiKey,
    )
    let batchedAnswers = []
    let batchError = null

    if (batchApiResponse.error) {
      console.error(
        "NetAcad Scraper (scraper.js): Error from batch API call:",
        batchApiResponse.error,
      )
      batchError = batchApiResponse.error
    } else if (
      batchApiResponse.answers &&
      batchApiResponse.answers.length === allQuestionsData.length
    ) {
      batchedAnswers = batchApiResponse.answers
      console.debug(
        "NetAcad Scraper (scraper.js): Successfully received batched answers.",
      )
    } else {
      console.error(
        "NetAcad Scraper (scraper.js): Mismatch in batched answers length or no answers received.",
      )
      batchError = "Error: AI response for batch was incomplete or malformed."
      if (batchApiResponse.answers) batchedAnswers = batchApiResponse.answers // Use partial if available
    }

    // Now, update each UI with its specific answer or the batch error
    for (let i = 0; i < allQuestionsData.length; i++) {
      const questionData = allQuestionsData[i]
      let finalAnswerToShow = batchError
        ? batchError
        : batchedAnswers[i] || "Error: No specific answer in batch response."
      // Re-call processSingleQuestion or a dedicated update function.
      // For simplicity, re-calling processSingleQuestion with the fetched answer.
      // It will re-extract, but then display the provided answer.
      // A more optimized way would be to have a separate UI update function.
      await processSingleQuestion(
        questionData.mcqViewElement,
        questionData.originalIndex,
        apiKey,
        finalAnswerToShow,
      )
    }
  } else {
    console.debug(
      "NetAcad Scraper (scraper.js): No valid questions extracted to send for batch processing.",
    )
    // If there were mcqViewElements but none yielded valid Q&A, their UIs would have been handled
    // in the extraction loop above, displaying individual extraction errors via processSingleQuestion.
  }

  return true
}
