function createAiAssistantUI(uiContainerId, index) {
  const uiContainer = document.createElement("div")
  uiContainer.id = uiContainerId
  uiContainer.className = "netacad-ai-assistant-ui"
  uiContainer.style.marginTop = "15px"
  uiContainer.style.padding = "10px"
  uiContainer.style.border = "1px solid #007bff"
  uiContainer.style.borderRadius = "5px"
  uiContainer.style.backgroundColor = "#e7f3ff"
  uiContainer.style.color = "#333"

  const titleElement = document.createElement("h5")
  titleElement.textContent = "AI Assistant"
  titleElement.style.marginTop = "0px"
  titleElement.style.marginBottom = "5px"
  titleElement.style.color = "#0056b3"
  uiContainer.appendChild(titleElement)

  const aiAnswerDisplay = document.createElement("p")
  aiAnswerDisplay.className = "ai-answer-display"
  aiAnswerDisplay.style.margin = "5px 0"
  aiAnswerDisplay.style.fontStyle = "italic"
  aiAnswerDisplay.textContent = "Initializing..."
  uiContainer.appendChild(aiAnswerDisplay)

  const refreshButton = document.createElement("button")
  refreshButton.className = "ai-refresh-button"
  refreshButton.textContent = "Refresh AI Answer"
  refreshButton.style.padding = "6px 12px"
  refreshButton.style.border = "none"
  refreshButton.style.borderRadius = "4px"
  refreshButton.style.backgroundColor = "#007bff"
  refreshButton.style.color = "white"
  refreshButton.style.cursor = "pointer"
  refreshButton.onmouseover = () =>
    (refreshButton.style.backgroundColor = "#0056b3")
  refreshButton.onmouseout = () =>
    (refreshButton.style.backgroundColor = "#007bff")
  uiContainer.appendChild(refreshButton)

  return { uiContainer, aiAnswerDisplay, refreshButton }
}

function extractQuestionAndAnswers(mcqViewElement, index) {
  let questionText = "Question text not found"
  let answerElements = []
  let questionTextElement = null

  try {
    if (mcqViewElement && mcqViewElement.shadowRoot) {
      const baseView = mcqViewElement.shadowRoot.querySelector(
        'base-view[type="component"]',
      )
      if (baseView && baseView.shadowRoot) {
        questionTextElement = baseView.shadowRoot.querySelector(
          "div.component__body-inner.mcq__body-inner",
        )
        if (!questionTextElement) {
          questionTextElement =
            baseView.shadowRoot.querySelector(".mcq__prompt")
        }
        if (!questionTextElement) {
          questionTextElement = baseView.shadowRoot.querySelector(".prompt")
        }

        if (questionTextElement) {
          questionText = questionTextElement.innerText.trim()
        } else {
          const potentialElements = Array.from(
            baseView.shadowRoot.querySelectorAll("div, p, span"),
          )
          for (const el of potentialElements) {
            const text = el.innerText.trim()
            if (text.length > 20) {
              questionText = text
              questionTextElement = el
              console.debug(
                `NetAcad UI: Used generic text search in base-view for question ${
                  index + 1
                }: ${questionText}. Element: <${el.tagName}>`,
              )
              break
            }
          }
          if (!questionTextElement) {
            console.warn(
              `NetAcad UI: Question text element not found via specific or generic selectors in base-view for mcq ${
                index + 1
              }.`,
            )
          }
        }
      } else {
        let directQuestionEl = mcqViewElement.shadowRoot.querySelector(
          "div.component__body-inner.mcq__body-inner",
        )
        if (!directQuestionEl) {
          directQuestionEl =
            mcqViewElement.shadowRoot.querySelector(".mcq__prompt")
        }
        if (!directQuestionEl) {
          directQuestionEl = mcqViewElement.shadowRoot.querySelector(".prompt")
        }

        if (directQuestionEl) {
          questionTextElement = directQuestionEl
          questionText = directQuestionEl.innerText.trim()
        } else {
          const potentialElements = Array.from(
            mcqViewElement.shadowRoot.querySelectorAll("div, p, span"),
          )
          for (const el of potentialElements) {
            const text = el.innerText.trim()
            if (text.length > 20) {
              questionText = text
              questionTextElement = el
              console.debug(
                `NetAcad UI: Used generic text search directly in mcq-view shadowRoot for question ${
                  index + 1
                }: ${questionText}. Element: <${el.tagName}>`,
              )
              break
            }
          }
          if (!questionTextElement) {
            console.warn(
              `NetAcad UI: Question text element not found in mcq ${
                index + 1
              } (no base-view or text not in mcq-view shadowRoot directly).`,
            )
          }
        }
      }
      answerElements = mcqViewElement.shadowRoot.querySelectorAll(
        ".mcq__item-label.js-item-label",
      )
    } else {
      console.warn(
        `NetAcad UI: MCQ View element or its shadowRoot is missing for question ${
          index + 1
        }`,
      )
      questionText = "Error: MCQ View element not accessible."
    }
  } catch (e) {
    console.error(
      `NetAcad UI: Error extracting Q&A for question ${index + 1}:`,
      e,
      mcqViewElement,
    )
    questionText = `Error extracting data. Check console.`
  }
  return { questionText, answerElements, questionTextElement }
}

function processAnswerElements(answerElements, index) {
  let answerTexts = []
  if (answerElements.length > 0) {
    console.debug("NetAcad UI: Possible Answers:")
    answerElements.forEach((answer, answerIndex) => {
      const ansText = answer.innerText.trim()
      answerTexts.push(ansText)
      console.debug(`NetAcad UI:   ${answerIndex + 1}: ${ansText}`)
    })
  } else {
    console.debug(
      `NetAcad UI: No answer elements found for question ${index + 1}.`,
    )
  }
  return answerTexts
}

function updateUiAndLogsPostExtraction(
  aiAnswerDisplay,
  questionText,
  answerTexts,
  index,
) {
  console.debug(`NetAcad UI: --- Question ${index + 1} --- Details --- `)
  console.debug("NetAcad UI: Question:", questionText)
  console.debug("NetAcad UI: Answers Extracted:", answerTexts)

  if (answerTexts.length === 0) {
    if (
      questionText !== "Question text not found" &&
      !questionText.startsWith("Error:")
    ) {
      aiAnswerDisplay.textContent =
        "AI Assistant: Question found, but no answer options detected."
    } else {
      aiAnswerDisplay.textContent = questionText // Show the extraction error
    }
  }

  if (
    questionText.startsWith("Error:") ||
    questionText === "Question text not found"
  ) {
    aiAnswerDisplay.textContent = questionText
  }
}

function injectUi(
  uiContainer,
  questionTextElement,
  mcqViewElement,
  uiContainerId,
  index,
) {
  let uiInjected = false
  if (questionTextElement && questionTextElement.parentNode) {
    try {
      const oldUiInPlace = questionTextElement.parentNode.querySelector(
        `#${uiContainerId}`,
      )
      if (oldUiInPlace) {
        console.debug(
          `NetAcad UI: Injection (Q ${
            index + 1
          }): Removing existing UI (id: ${uiContainerId}) from questionTextElement's parent.`,
        )
        oldUiInPlace.remove()
      }

      console.debug(
        `NetAcad UI: Injection (Q ${index + 1}): Preparing to inject. uiContainer.id: ${
          uiContainer.id
        }, uiContainer.outerHTML (brief): ${uiContainer.outerHTML.substring(
          0,
          100,
        )}...`,
      )
      console.debug(
        `NetAcad UI: Injection (Q ${index + 1}): questionTextElement is <${
          questionTextElement.tagName
        }>. Parent is <${questionTextElement.parentNode.tagName}>.`,
      )

      questionTextElement.parentNode.insertBefore(
        uiContainer,
        questionTextElement.nextSibling,
      )

      const injectedElementCheck = questionTextElement.parentNode.querySelector(
        `#${uiContainerId}`,
      )
      if (injectedElementCheck) {
        console.debug(
          `NetAcad UI: Injection (Q ${
            index + 1
          }): SUCCESS - Injected after questionTextElement. Element #${uiContainerId} FOUND in parent. Parent: <${
            questionTextElement.parentNode.tagName
          }>, questionTextElement: <${
            questionTextElement.tagName
          }>. Injected el: <${injectedElementCheck.tagName}>`,
        )
        uiInjected = true

        // Deferred check
        setTimeout(() => {
          const stillThereCheck = document.getElementById(uiContainerId) // Check globally as it might have been moved
          if (stillThereCheck) {
            console.debug(
              `NetAcad UI: Injection (Q ${
                index + 1
              }) DEFERRED CHECK: Element #${uiContainerId} IS STILL in the DOM (document.getElementById). Visible: ${!!stillThereCheck.offsetParent}`,
            )
            const parentNode = stillThereCheck.parentNode
            const rootNode = parentNode ? parentNode.getRootNode() : null
            let hostInfo =
              "Parent context unclear (element may have been moved)."
            if (rootNode && rootNode instanceof ShadowRoot) {
              hostInfo = `Parent is in a ShadowRoot. Host: <${
                rootNode.host.tagName
              } id="${rootNode.host.id}" class="${rootNode.host.className}">. Host visible: ${!!rootNode.host.offsetParent}.`
            } else if (rootNode) {
              hostInfo = `Parent's rootNode is <${rootNode.nodeName}>.`
            }
            console.debug(
              `NetAcad UI: Injection (Q ${
                index + 1
              }) DEFERRED CHECK - Parent Context: ${hostInfo}. Parent Tag: ${
                parentNode ? `<${parentNode.tagName}>` : "N/A"
              }. Parent visible: ${!!(parentNode && parentNode.offsetParent)}`,
            )
          } else {
            // If not found by document.getElementById, check the original parent
            const originalParent = questionTextElement
              ? questionTextElement.parentNode
              : null
            if (!originalParent) {
              console.error(
                `NetAcad UI: Injection (Q ${
                  index + 1
                }) DEFERRED CHECK: Original parent (questionTextElement.parentNode) is null. Cannot check further.`,
              )
              return
            }

            const stillInOriginalParentCheck = originalParent.querySelector(
              `#${uiContainerId}`,
            )
            if (stillInOriginalParentCheck) {
              const rootNode = originalParent.getRootNode()
              let hostInfo =
                "Original parent is not in a Shadow DOM or getRootNode is document."
              if (rootNode instanceof ShadowRoot) {
                hostInfo = `Original parent is in a ShadowRoot. Host: <${
                  rootNode.host.tagName
                } id="${rootNode.host.id}" class="${
                  rootNode.host.className
                }">. Host visible: ${!!rootNode.host.offsetParent}.`
              } else if (rootNode === document) {
                hostInfo = "Original parent's rootNode is the main document."
              } else {
                hostInfo = `Original parent's rootNode is of type ${
                  rootNode.nodeName || "unknown"
                }`
              }
              console.debug(
                `NetAcad UI: Injection (Q ${
                  index + 1
                }) DEFERRED CHECK - Original Parent Context: ${hostInfo}. Original Parent Tag: <${
                  originalParent.tagName
                }>. Original Parent Visible (offsetParent): ${!!originalParent.offsetParent}`,
              )
            } else {
              console.error(
                `NetAcad UI: Injection (Q ${
                  index + 1
                }) DEFERRED CHECK: Element #${uiContainerId} NO LONGER in original parent NOR by document.getElementById. Likely removed or parent changed.`,
              )
            }
          }
        }, 500)
      } else {
        console.error(
          `NetAcad UI: Injection (Q ${
            index + 1
          }): CRITICAL FAILURE - insertBefore called, but element #${uiContainerId} NOT FOUND in parent immediately after. Parent: <${
            questionTextElement.parentNode.tagName
          }>, questionTextElement: <${questionTextElement.tagName}>.`,
        )
        uiInjected = false // Explicitly set to false
      }
    } catch (e) {
      console.warn(
        `NetAcad UI: Injection (Q ${
          index + 1
        }): FAILED to inject after questionTextElement. Parent: ${
          questionTextElement.parentNode
            ? `<${questionTextElement.parentNode.tagName}>`
            : "null"
        }, questionTextElement: <${questionTextElement.tagName}>. Error:`,
        e,
      )
    }
  } else {
    console.debug(
      `NetAcad UI: Injection (Q ${
        index + 1
      }): SKIPPED - questionTextElement (found: ${!!questionTextElement}) or its parentNode (parent exists: ${!!(
        questionTextElement && questionTextElement.parentNode
      )}) is missing.`,
    )
  }

  if (!uiInjected && mcqViewElement && mcqViewElement.shadowRoot) {
    console.debug(
      `NetAcad UI: Injection (Q ${
        index + 1
      }): Attempting fallback to mcqViewElement.shadowRoot.`,
    )
    mcqViewElement.shadowRoot.appendChild(uiContainer)
    console.debug(
      `NetAcad UI: Injection (Q ${
        index + 1
      }): SUCCESS - Injected into mcqViewElement.shadowRoot.`,
    )
    uiInjected = true
  } else if (!uiInjected) {
    console.debug(
      `NetAcad UI: Injection (Q ${
        index + 1
      }): SKIPPED - mcqViewElement (found: ${!!mcqViewElement}) or its shadowRoot (shadowRoot exists: ${!!(
        mcqViewElement && mcqViewElement.shadowRoot
      )}) is missing for direct shadowRoot append.`,
    )
  }

  if (!uiInjected) {
    const hostElement = mcqViewElement
      ? mcqViewElement.getRootNode().host
      : null
    console.debug(
      `NetAcad UI: Injection (Q ${
        index + 1
      }): Attempting fallback via hostElement. mcqViewElement present: ${!!mcqViewElement}, hostElement: ${
        hostElement ? `<${hostElement.tagName}>` : "null"
      }`,
    )
    if (hostElement && hostElement.parentElement) {
      console.debug(
        `NetAcad UI: Injection (Q ${index + 1}): hostElement.parentElement: ${
          hostElement.parentElement
            ? `<${hostElement.parentElement.tagName}>`
            : "null"
        }`,
      )
      // Try to remove existing UI if it was placed here by ID
      const existingUiByHost = hostElement.parentElement.querySelector(
        `#${uiContainerId}`,
      )
      if (
        existingUiByHost &&
        existingUiByHost.parentElement === hostElement.parentElement
      ) {
        console.debug(
          `NetAcad UI: Injection (Q ${
            index + 1
          }): Removing existing UI (id: ${uiContainerId}) from hostElement.parentElement.`,
        )
        existingUiByHost.remove()
      }

      if (hostElement.nextSibling) {
        hostElement.parentElement.insertBefore(
          uiContainer,
          hostElement.nextSibling,
        )
        console.debug(
          `NetAcad UI: Injection (Q ${
            index + 1
          }): SUCCESS - Injected via hostElement.parentElement, before hostElement.nextSibling.`,
        )
      } else {
        hostElement.parentElement.appendChild(uiContainer)
        console.debug(
          `NetAcad UI: Injection (Q ${
            index + 1
          }): SUCCESS - Appended via hostElement.parentElement.`,
        )
      }
      uiInjected = true
    } else if (!uiInjected) {
      console.debug(
        `NetAcad UI: Injection (Q ${
          index + 1
        }): SKIPPED - hostElement (found: ${!!hostElement}) or hostElement.parentElement (found: ${!!(
          hostElement && hostElement.parentElement
        )}) is missing.`,
      )
      // Try to remove existing UI if it was placed here by ID
      const existingUiInBody = document.body.querySelector(`#${uiContainerId}`)
      if (
        existingUiInBody &&
        existingUiInBody.parentElement === document.body
      ) {
        console.debug(
          `NetAcad UI: Injection (Q ${
            index + 1
          }): Removing existing UI (id: ${uiContainerId}) from document.body.`,
        )
        existingUiInBody.remove()
      }

      console.warn(
        `NetAcad UI: Injection (Q ${
          index + 1
        }): CRITICAL FALLBACK - Appending to document.body.`,
      )
      document.body.appendChild(uiContainer)
      uiInjected = true
    }
  }
  return uiInjected
}

function getFriendlyGeminiErrorMessage(errorString) {
  // Handles known Gemini API error patterns
  if (!errorString) return null
  if (
    errorString.includes("503") &&
    errorString.toLowerCase().includes("overload")
  ) {
    return "AI Suggestion: Gemini API is overloaded. Please try again later."
  }
  if (
    errorString.includes("503") &&
    errorString.toLowerCase().includes("unavailable")
  ) {
    return "AI Suggestion: Gemini API is currently unavailable (503). Please try again later."
  }
  if (errorString.includes("quota")) {
    return "AI Suggestion: Gemini API quota exceeded. Please check your API usage or try again later."
  }
  if (
    errorString.includes("invalid") &&
    errorString.toLowerCase().includes("key")
  ) {
    return "AI Suggestion: Invalid Gemini API Key. Please check your key in the extension popup."
  }
  // Add more patterns as needed
  return null
}

async function handleRefreshAction(
  questionText,
  answerTexts,
  apiKey,
  aiAnswerDisplay,
  index,
) {
  if (!aiAnswerDisplay) return

  if (!apiKey) {
    aiAnswerDisplay.textContent =
      "API Key not set. Please set it in the extension popup."
    console.warn(
      `NetAcad UI: refreshAction for Q${index + 1}: API Key not available.`,
    )
    return
  }

  if (
    questionText === "Question text not found" ||
    questionText.startsWith("Error:")
  ) {
    aiAnswerDisplay.textContent = questionText // Reshow extraction error
    console.warn(
      `NetAcad UI: refreshAction for Q${
        index + 1
      }: Aborted due to question extraction issue: ${questionText}`,
    )
    return
  }
  if (answerTexts.length === 0) {
    aiAnswerDisplay.textContent =
      "AI Assistant: No answer options available to send to AI."
    console.warn(
      `NetAcad UI: refreshAction for Q${index + 1}: Aborted, no answer texts.`,
    )
    return
  }

  aiAnswerDisplay.textContent = "Asking Gemini AI (single refresh)..."
  console.debug(
    `NetAcad UI: refreshAction for Q${
      index + 1
    }: Asking Gemini AI for question: "${questionText.substring(0, 50)}..."`,
  )
  const rawAiResponse = await getAiAnswer(questionText, answerTexts, apiKey)

  console.debug(
    `NetAcad UI: AI Answer (single refresh) received for Q${index + 1}: '${rawAiResponse}' (Full text)`,
  )

  if (
    rawAiResponse &&
    rawAiResponse.trim() !== "" &&
    !rawAiResponse.toLowerCase().startsWith("error:")
  ) {
    const individualAnswers = rawAiResponse
      .split("\n")
      .map((ans) => ans.trim())
      .filter((ans) => ans.length > 0)
    if (individualAnswers.length > 1) {
      aiAnswerDisplay.innerHTML =
        "AI Suggestions:<br />- " + individualAnswers.join("<br />- ")
      console.debug(
        `NetAcad UI: Q${index + 1} (single refresh) multiple answers:`,
        individualAnswers,
      )
    } else if (individualAnswers.length === 1) {
      aiAnswerDisplay.textContent = `AI Suggestion: ${individualAnswers[0]}`
      console.debug(
        `NetAcad UI: Q${index + 1} (single refresh) single answer: ${individualAnswers[0]}`,
      )
    } else {
      aiAnswerDisplay.textContent =
        "AI Suggestion: No valid answer content received (single refresh)."
      console.warn(
        `NetAcad UI: Q${index + 1} (single refresh) AI response was empty or only whitespace after processing: '${rawAiResponse}'`,
      )
    }
  } else if (
    rawAiResponse &&
    rawAiResponse.toLowerCase().startsWith("error:")
  ) {
    // Improved error handling
    const friendlyMsg = getFriendlyGeminiErrorMessage(rawAiResponse)
    if (friendlyMsg) {
      aiAnswerDisplay.textContent = friendlyMsg
    } else {
      aiAnswerDisplay.textContent = rawAiResponse // Display the error message directly
    }
    console.error(
      `NetAcad UI: Error displayed for Q${index + 1} (single refresh): ${rawAiResponse}`,
    )
  } else {
    aiAnswerDisplay.textContent =
      "AI Suggestion: No answer received or answer was empty (single refresh)."
    console.warn(
      `NetAcad UI: AI returned empty or whitespace-only answer for Q${
        index + 1
      } (single refresh). Original response: '${rawAiResponse}'`,
    )
  }
}

function normalizeAnswerText(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\.\,\;\:\!\?\"\']/g, "")
    .trim()
}

function clearAnswerHighlights(answerElements) {
  if (!answerElements) return
  answerElements.forEach((el) => {
    if (el && el.dataset && el.dataset.netacadHighlighted) {
      el.style.backgroundColor = el.dataset.netacadOrigBg || ""
      el.style.boxShadow = el.dataset.netacadOrigShadow || ""
      delete el.dataset.netacadHighlighted
      delete el.dataset.netacadOrigBg
      delete el.dataset.netacadOrigShadow
    }
  })
}

function highlightMatchingAnswers(answerElements, aiAnswerRaw, index) {
  if (!aiAnswerRaw || typeof aiAnswerRaw !== "string") return
  if (aiAnswerRaw.toLowerCase().startsWith("error:")) return
  if (aiAnswerRaw === "BATCH_PROCESSING_STARTED") return

  const candidates = aiAnswerRaw
    .split(/\s*\/\/\/\s*|\n/)
    .map((s) => normalizeAnswerText(s))
    .filter(Boolean)

  if (!candidates.length) return

  const els = Array.from(answerElements)
  const optionTexts = els.map((el) => normalizeAnswerText(el.innerText))
  const used = new Set()

  const assignOption = (candidate) => {
    // 1. Exact match.
    let idx = optionTexts.findIndex((t, i) => !used.has(i) && t === candidate)
    if (idx !== -1) return idx
    // 2. Option text contains the entire candidate (e.g. candidate is shorter / a fragment).
    idx = optionTexts.findIndex((t, i) => !used.has(i) && t.includes(candidate))
    if (idx !== -1) return idx
    // 3. Candidate contains an option text (e.g. AI returned a verbose phrasing).
    //    Prefer the LONGEST option contained — avoids "proxy server" matching "reverse proxy server".
    let bestIdx = -1
    let bestLen = 0
    for (let i = 0; i < optionTexts.length; i++) {
      if (used.has(i)) continue
      const t = optionTexts[i]
      if (t && candidate.includes(t) && t.length > bestLen) {
        bestIdx = i
        bestLen = t.length
      }
    }
    return bestIdx
  }

  let matched = 0
  candidates.forEach((c) => {
    const idx = assignOption(c)
    if (idx === -1) return
    used.add(idx)
    const el = els[idx]
    el.dataset.netacadOrigBg = el.style.backgroundColor || ""
    el.dataset.netacadOrigShadow = el.style.boxShadow || ""
    el.dataset.netacadHighlighted = "1"
    el.style.backgroundColor = "rgba(76, 175, 80, 0.05)"
    el.style.boxShadow = "inset 1px 0 0 rgba(46, 125, 50, 0.12)"
    matched++
  })
  console.debug(
    `NetAcad UI: Q${index + 1} highlighted ${matched}/${els.length} options.`,
  )

  if (matched > 0) {
    const highlightedEls = Array.from(answerElements).filter(
      (el) => el && el.dataset && el.dataset.netacadHighlighted,
    )

    highlightedEls.forEach((el) => {
      const handler = () => {
        clearAnswerHighlights([el])
        el.removeEventListener("click", handler, true)
        delete el.__netacadClearHandler
      }
      el.__netacadClearHandler = handler
      el.addEventListener("click", handler, true)
    })
  }
}

async function fetchAiAnswerSilent(questionText, answerTexts, apiKey, index) {
  if (!apiKey || answerTexts.length === 0) return null
  if (
    questionText === "Question text not found" ||
    questionText.startsWith("Error:")
  )
    return null
  console.debug(
    `NetAcad UI: Q${index + 1} fetching AI answer (silent/individual).`,
  )
  const raw = await getAiAnswer(questionText, answerTexts, apiKey)
  return raw
}

async function processSingleQuestion(
  mcqViewElement,
  index,
  apiKey,
  preFetchedAiAnswer = null,
) {
  const uiContainerId = `netacad-ai-q-${index}`

  // Remove any legacy visible UI blocks from prior versions.
  if (mcqViewElement && mcqViewElement.shadowRoot) {
    mcqViewElement.shadowRoot
      .querySelectorAll(`#${uiContainerId}, .netacad-ai-assistant-ui`)
      .forEach((el) => el.remove())
  }

  const { questionText, answerElements, questionTextElement } =
    extractQuestionAndAnswers(mcqViewElement, index)
  const answerTexts = processAnswerElements(answerElements, index)

  // Clear any previous highlights before reapplying.
  clearAnswerHighlights(answerElements)

  if (
    questionText.startsWith("Error:") ||
    questionText === "Question text not found" ||
    answerTexts.length === 0
  ) {
    console.debug(
      `NetAcad UI: Q${index + 1} skipping highlight — extraction issue or no options.`,
    )
    return
  }

  // Local DB lookup first — if we already know the answers, skip everything else.
  if (typeof findLocalAnswers === "function") {
    const local = findLocalAnswers(questionText)
    if (local && local.length > 0) {
      console.log(
        `NetAcad UI: Q${index + 1} ✓ local DB (${local.length} option(s)).`,
      )
      highlightMatchingAnswers(answerElements, local.join(" /// "), index)
      return
    }
  }

  // Online itexamanswers.net lookup — second-tier before AI.
  if (
    typeof findOnlineAnswers === "function" &&
    preFetchedAiAnswer !== "BATCH_PROCESSING_STARTED"
  ) {
    console.log(`NetAcad UI: Q${index + 1} → itexamanswers.net …`)
    const online = await findOnlineAnswers(questionText)
    if (online && online.length > 0) {
      console.log(
        `NetAcad UI: Q${index + 1} ✓ itexamanswers.net (${online.length} option(s)).`,
      )
      highlightMatchingAnswers(answerElements, online.join(" /// "), index)
      return
    }
    console.log(
      `NetAcad UI: Q${index + 1} ✗ itexamanswers.net (no match) — falling back to AI.`,
    )
  }

  if (preFetchedAiAnswer === "BATCH_PROCESSING_STARTED") {
    return // wait silently; final call will arrive with the real answer
  }

  if (preFetchedAiAnswer) {
    if (preFetchedAiAnswer.toLowerCase().startsWith("error:")) {
      console.error(
        `NetAcad UI: Q${index + 1} AI error (silent): ${preFetchedAiAnswer}`,
      )
      return
    }
    highlightMatchingAnswers(answerElements, preFetchedAiAnswer, index)
    return
  }

  if (!apiKey) {
    console.warn(
      `NetAcad UI: Q${index + 1} cannot fetch AI answer — API key missing.`,
    )
    return
  }

  const raw = await fetchAiAnswerSilent(
    questionText,
    answerTexts,
    apiKey,
    index,
  )
  if (raw && !raw.toLowerCase().startsWith("error:")) {
    highlightMatchingAnswers(answerElements, raw, index)
  } else if (raw) {
    console.error(`NetAcad UI: Q${index + 1} AI error (silent): ${raw}`)
  }
}

// ---------- Shared helper: figure out which option a user just picked ----------

function getChosenOptionText(event, trigger, eventType) {
  if (eventType === "change") {
    const sel = event.target
    if (sel && sel.options && typeof sel.selectedIndex === "number") {
      const opt = sel.options[sel.selectedIndex]
      if (opt) return (opt.textContent || opt.value || "").trim()
    }
    return ""
  }
  // Dropdown-list click: find the .dropdown__item inside the path.
  const path =
    (typeof event.composedPath === "function" ? event.composedPath() : []) || []
  for (const node of path) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) continue
    if (
      node.matches &&
      node.matches(".dropdown__item, .js-dropdown-list-item")
    ) {
      const inner =
        node.querySelector(
          ".dropdown__item-inner, .js-dropdown-list-item-inner",
        ) || node
      return (inner.getAttribute("value") || inner.textContent || "").trim()
    }
    if (
      node.matches &&
      node.matches(".dropdown__item-inner, .js-dropdown-list-item-inner")
    ) {
      return (node.getAttribute("value") || node.textContent || "").trim()
    }
    if (node === trigger) break
  }
  return ""
}

// ---------- Matching questions ----------

function extractMatchingQuestion(matchingViewElement, index) {
  let prompt = "Question text not found"
  const items = []
  const optionPool = new Set()

  try {
    const sr = matchingViewElement && matchingViewElement.shadowRoot
    if (!sr) return { prompt, items, optionPool: [] }

    const baseView = sr.querySelector('base-view[type="component"]')
    const baseSr = baseView && baseView.shadowRoot

    // --- Prompt ---
    const promptCandidates = [
      baseSr &&
        baseSr.querySelector(".component__body-inner.matching__body-inner"),
      baseSr && baseSr.querySelector(".matching__body-inner"),
      baseSr && baseSr.querySelector(".component__body-inner"),
      sr.querySelector(".matching__body-inner"),
      sr.querySelector(".matching__title-inner"),
      sr.querySelector(".matching__prompt"),
      sr.querySelector(".matching__title"),
    ].filter(Boolean)
    let promptEl = promptCandidates[0] || null
    if (!promptEl) {
      const searchRoots = [sr, baseSr].filter(Boolean)
      for (const r of searchRoots) {
        for (const el of Array.from(
          r.querySelectorAll("div, p, span, h1, h2, h3, h4"),
        )) {
          const t = (el.innerText || "").trim()
          if (t.length > 15) {
            promptEl = el
            break
          }
        }
        if (promptEl) break
      }
    }
    if (promptEl) prompt = promptEl.innerText.trim()

    // --- Modern: each row is a <matching-dropdown-view> with its own shadow root ---
    const dropdownRows = sr.querySelectorAll("matching-dropdown-view")
    dropdownRows.forEach((row) => {
      const rowSr = row.shadowRoot
      if (!rowSr) return
      const innerTitleEl =
        rowSr.querySelector(
          ".matching__item-title .matching__item-title_inner",
        ) || rowSr.querySelector(".matching__item-title")
      if (!innerTitleEl) return
      const title = (innerTitleEl.innerText || "").trim()
      const optEls = rowSr.querySelectorAll(
        ".dropdown__list .dropdown__item-inner, .js-dropdown-list-item-inner",
      )
      const optionTexts = Array.from(optEls)
        .map((o) => (o.getAttribute("value") || o.textContent || "").trim())
        .filter((t) => t && !/^please select/i.test(t))
      optionTexts.forEach((t) => optionPool.add(t))
      const dropdownList = rowSr.querySelector(
        ".dropdown__list, .js-dropdown-list",
      )
      if (title) {
        items.push({
          title,
          titleEl: innerTitleEl,
          optionTexts,
          clearTriggerEl: dropdownList || row,
          clearTriggerEvent: "click",
          itemEl: row,
        })
      }
    })

    // --- Legacy fallback: native <select>-based matching items ---
    if (items.length === 0) {
      const searchRoots = [sr, baseSr].filter(Boolean)
      const seenItems = new Set()
      searchRoots.forEach((r) => {
        r.querySelectorAll(
          ".matching__item, .matching-item, .js-matching-item",
        ).forEach((itemEl) => {
          if (seenItems.has(itemEl)) return
          seenItems.add(itemEl)
          const titleEl =
            itemEl.querySelector(
              ".matching__item-title, .matching__item-text, .matching__item-prompt, .js-item-title, .item-title, .title",
            ) || itemEl.querySelector("label, span")
          const selectEl = itemEl.querySelector("select")
          if (!titleEl || !selectEl) return
          const title = (titleEl.innerText || "").trim()
          const optionTexts = Array.from(selectEl.options)
            .map((o) => (o.textContent || "").trim())
            .filter((t) => t && !/^(select|choose|pick|--)/i.test(t))
          optionTexts.forEach((t) => optionPool.add(t))
          if (title) {
            items.push({
              title,
              titleEl,
              optionTexts,
              clearTriggerEl: selectEl,
              clearTriggerEvent: "change",
              itemEl,
            })
          }
        })
      })
    }
  } catch (e) {
    console.error(`NetAcad UI: matching extraction error Q${index + 1}:`, e)
  }
  return { prompt, items, optionPool: Array.from(optionPool) }
}

function clearMatchingHintFor(item) {
  if (!item) return
  if (item._netacadHint && item._netacadHint.parentNode) {
    item._netacadHint.parentNode.removeChild(item._netacadHint)
  }
  delete item._netacadHint
  const trig = item.clearTriggerEl || item.selectEl
  const evt = item.clearTriggerEvent || "click"
  if (trig && trig.__netacadClearHandler) {
    trig.removeEventListener(evt, trig.__netacadClearHandler, true)
    delete trig.__netacadClearHandler
  }
}

function clearMatchingHints(items) {
  if (!items) return
  items.forEach(clearMatchingHintFor)
}

function applyMatchingHints(items, mapping, index) {
  if (!mapping || typeof mapping !== "object") return 0
  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[\.\,\;\:\!\?\"\']/g, "")
      .trim()
  const normMapping = {}
  Object.entries(mapping).forEach(([k, v]) => {
    normMapping[norm(k)] = typeof v === "string" ? v : String(v)
  })

  let hinted = 0
  items.forEach((it) => {
    const guess = normMapping[norm(it.title)]
    if (!guess) return
    let matched =
      it.optionTexts.find((o) => norm(o) === norm(guess)) ||
      it.optionTexts.find(
        (o) => norm(o).includes(norm(guess)) || norm(guess).includes(norm(o)),
      ) ||
      guess

    const hint = document.createElement("span")
    hint.textContent = " → " + matched
    hint.dataset.netacadMatchingHint = "1"
    hint.style.cssText =
      "color: rgba(46, 125, 50, 0.22); font-size: 0.72em; margin-left: 6px; font-style: italic; font-weight: 400;"
    it.titleEl.appendChild(hint)
    it._netacadHint = hint
    it._netacadSuggested = matched
    hinted++
  })

  if (hinted > 0) {
    items.forEach((it) => {
      const trig = it.clearTriggerEl || it.selectEl
      const evt = it.clearTriggerEvent || "click"
      if (!trig) return
      const suggested = norm(it._netacadSuggested || "")
      const handler = (e) => {
        const chosen = getChosenOptionText(e, trig, evt)
        if (!chosen) return
        if (norm(chosen) === suggested) clearMatchingHintFor(it)
      }
      trig.__netacadClearHandler = handler
      trig.addEventListener(evt, handler, true)
    })
  }
  console.debug(
    `NetAcad UI: Matching Q${index + 1} hinted ${hinted}/${items.length} items.`,
  )
  return hinted
}

async function processSingleMatchingQuestion(
  matchingViewElement,
  index,
  apiKey,
) {
  const { prompt, items, optionPool } = extractMatchingQuestion(
    matchingViewElement,
    index,
  )
  clearMatchingHints(items)

  if (
    !prompt ||
    prompt === "Question text not found" ||
    items.length === 0 ||
    optionPool.length === 0
  ) {
    console.debug(
      `NetAcad UI: Matching Q${index + 1} skipped — prompt:"${prompt.slice(0, 40)}", items:${items.length}, pool:${optionPool.length}.`,
    )
    return
  }

  if (!apiKey) {
    console.warn(
      `NetAcad UI: Matching Q${index + 1} cannot fetch AI — API key missing.`,
    )
    return
  }

  const itemTexts = items.map((it) => it.title)
  const result = await getAiMatching(prompt, itemTexts, optionPool, apiKey)
  if (result.error) {
    console.error(
      `NetAcad UI: Matching Q${index + 1} AI error: ${result.error}`,
    )
    return
  }
  applyMatchingHints(items, result.mapping, index)
}

// ---------- Fill-in-the-blanks questions ----------

function extractFillBlanksQuestion(fbViewElement, index) {
  let sentence = ""
  const blanks = []
  const sentenceParts = []

  try {
    const sr = fbViewElement && fbViewElement.shadowRoot
    if (!sr) return { sentence, blanks }

    const itemEls = sr.querySelectorAll(".fillblanks__item, .fillblanks-item")
    itemEls.forEach((itemEl) => {
      const segments = []
      itemEl.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = (node.textContent || "").replace(/\s+/g, " ").trim()
          if (t) segments.push(t)
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase()
          if (tag === "fillblanks-dropdown-view") {
            const blankIndex = blanks.length + 1
            segments.push(`___[${blankIndex}]`)
            const ddSr = node.shadowRoot
            if (ddSr) {
              const optEls = ddSr.querySelectorAll(
                ".dropdown__list .dropdown__item-inner, .js-dropdown-list-item-inner",
              )
              const optionTexts = Array.from(optEls)
                .map((o) =>
                  (o.getAttribute("value") || o.textContent || "").trim(),
                )
                .filter((t) => t && !/^please select/i.test(t))
              const dropdownList = ddSr.querySelector(
                ".dropdown__list, .js-dropdown-list",
              )
              blanks.push({
                dropdownViewEl: node,
                optionTexts,
                clearTriggerEl: dropdownList || node,
                clearTriggerEvent: "click",
              })
            }
          } else {
            const t = (node.innerText || node.textContent || "")
              .replace(/\s+/g, " ")
              .trim()
            if (t) segments.push(t)
          }
        }
      })
      if (segments.length) sentenceParts.push(segments.join(" "))
    })
    sentence = sentenceParts.join("\n\n")
  } catch (e) {
    console.error(`NetAcad UI: fillblanks extraction error Q${index + 1}:`, e)
  }
  return { sentence, blanks }
}

function clearFillBlanksHintFor(blank) {
  if (!blank) return
  if (blank._netacadHint && blank._netacadHint.parentNode) {
    blank._netacadHint.parentNode.removeChild(blank._netacadHint)
  }
  delete blank._netacadHint
  const trig = blank.clearTriggerEl
  const evt = blank.clearTriggerEvent || "click"
  if (trig && trig.__netacadClearHandler) {
    trig.removeEventListener(evt, trig.__netacadClearHandler, true)
    delete trig.__netacadClearHandler
  }
}

function clearFillBlanksHints(blanks) {
  if (!blanks) return
  blanks.forEach(clearFillBlanksHintFor)
}

function applyFillBlanksHints(blanks, answers, index) {
  if (!Array.isArray(answers)) return 0
  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[\.\,\;\:\!\?\"\']/g, "")
      .trim()

  let hinted = 0
  blanks.forEach((blank, i) => {
    const guess = answers[i]
    if (!guess || typeof guess !== "string") return
    const ng = norm(guess)
    let matched =
      blank.optionTexts.find((o) => norm(o) === ng) ||
      blank.optionTexts.find(
        (o) => norm(o).includes(ng) || ng.includes(norm(o)),
      ) ||
      guess

    const hint = document.createElement("span")
    hint.textContent = " → " + matched
    hint.dataset.netacadFillblanksHint = "1"
    hint.style.cssText =
      "color: rgba(46, 125, 50, 0.22); font-size: 0.72em; margin-left: 4px; font-style: italic; font-weight: 400;"
    if (blank.dropdownViewEl && blank.dropdownViewEl.insertAdjacentElement) {
      blank.dropdownViewEl.insertAdjacentElement("afterend", hint)
      blank._netacadHint = hint
      blank._netacadSuggested = matched
      hinted++
    }
  })

  if (hinted > 0) {
    blanks.forEach((b) => {
      const trig = b.clearTriggerEl
      const evt = b.clearTriggerEvent || "click"
      if (!trig) return
      const suggested = norm(b._netacadSuggested || "")
      const handler = (e) => {
        const chosen = getChosenOptionText(e, trig, evt)
        if (!chosen) return
        if (norm(chosen) === suggested) clearFillBlanksHintFor(b)
      }
      trig.__netacadClearHandler = handler
      trig.addEventListener(evt, handler, true)
    })
  }
  console.debug(
    `NetAcad UI: Fillblanks Q${index + 1} hinted ${hinted}/${blanks.length} blanks.`,
  )
  return hinted
}

async function processSingleFillBlanksQuestion(fbViewElement, index, apiKey) {
  const { sentence, blanks } = extractFillBlanksQuestion(fbViewElement, index)
  clearFillBlanksHints(blanks)

  if (!sentence || blanks.length === 0) {
    console.debug(
      `NetAcad UI: Fillblanks Q${index + 1} skipped — sentence:"${sentence.slice(0, 60)}", blanks:${blanks.length}.`,
    )
    return
  }
  if (!apiKey) {
    console.warn(
      `NetAcad UI: Fillblanks Q${index + 1} cannot fetch AI — API key missing.`,
    )
    return
  }
  const result = await getAiFillBlanks(sentence, blanks, apiKey)
  if (result.error) {
    console.error(
      `NetAcad UI: Fillblanks Q${index + 1} AI error: ${result.error}`,
    )
    return
  }
  applyFillBlanksHints(blanks, result.answers, index)
}

// ---------- Object-matching questions (drag-line style) ----------
// Correct pairings are encoded in matching `data-id` between categories and options.

function clearObjectMatchingHintFor(item) {
  if (!item) return
  if (item._netacadHint && item._netacadHint.parentNode) {
    item._netacadHint.parentNode.removeChild(item._netacadHint)
  }
  delete item._netacadHint
  if (item.optionBtn && item.optionBtn.__netacadClearHandler) {
    item.optionBtn.removeEventListener(
      "click",
      item.optionBtn.__netacadClearHandler,
      true,
    )
    delete item.optionBtn.__netacadClearHandler
  }
}

function clearObjectMatchingHints(items) {
  if (!items) return
  items.forEach(clearObjectMatchingHintFor)
}

function processSingleObjectMatchingQuestion(omViewElement, index) {
  const sr = omViewElement && omViewElement.shadowRoot
  if (!sr) {
    console.debug(
      `NetAcad UI: objMatching Q${index + 1} skipped — no shadowRoot.`,
    )
    return
  }

  // Build a map of category data-id → letter (A/B/C/D/...).
  const categoryLetterById = new Map()
  sr.querySelectorAll(".objectMatching-category-item").forEach((btn) => {
    const id = btn.getAttribute("data-id")
    if (id == null) return
    const letterEl = btn.querySelector(".category-item-number")
    const letter = letterEl
      ? (letterEl.innerText || letterEl.textContent || "").trim()
      : ""
    if (letter) categoryLetterById.set(id, letter)
  })

  // For each option button, look up its matching category letter via shared data-id.
  const items = []
  sr.querySelectorAll(".objectMatching-option-item").forEach((btn) => {
    const id = btn.getAttribute("data-id")
    if (id == null) return
    const letter = categoryLetterById.get(id)
    if (!letter) return
    const textEl = btn.querySelector(".category-item-text")
    if (!textEl) return
    items.push({ optionBtn: btn, textEl, letter })
  })

  if (items.length === 0) {
    console.debug(`NetAcad UI: objMatching Q${index + 1} no items resolved.`)
    return
  }

  // Clear any previous hints (re-scrape safety).
  clearObjectMatchingHints(items)

  items.forEach((it) => {
    const hint = document.createElement("span")
    hint.textContent = " → " + it.letter
    hint.dataset.netacadObjmHint = "1"
    hint.style.cssText =
      "color: rgba(46, 125, 50, 0.22); font-size: 0.72em; margin-left: 6px; font-style: italic; font-weight: 400;"
    it.textEl.appendChild(hint)
    it._netacadHint = hint

    const handler = () => clearObjectMatchingHintFor(it)
    it.optionBtn.__netacadClearHandler = handler
    it.optionBtn.addEventListener("click", handler, true)
  })
  console.log(
    `NetAcad UI: objMatching Q${index + 1} hinted ${items.length} option(s) from data-id mapping.`,
  )
}
