// ---------- itexamanswers.net online lookup ----------

const ITEXAM_AUTOSUGGEST_URL =
  "https://itexamanswers.net/wp-admin/admin-ajax.php"
const ITEXAM_NONCE_PAGE = "https://itexamanswers.net/questions-list"
const _itexamCache = new Map() // normalized question -> answers[] | null
let _itexamNonce = null
let _itexamNoncePending = null

function _itexamNorm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function _itexamGetNonce(forceRefresh = false) {
  if (_itexamNonce && !forceRefresh) return _itexamNonce
  if (_itexamNoncePending) return _itexamNoncePending
  _itexamNoncePending = (async () => {
    try {
      const res = await fetch(ITEXAM_NONCE_PAGE, { credentials: "omit" })
      if (!res.ok) throw new Error(`nonce page HTTP ${res.status}`)
      const html = await res.text()
      const m = html.match(/data-nonce=["']([a-f0-9]+)["']/i)
      if (!m) throw new Error("nonce not found in HTML")
      _itexamNonce = m[1]
      return _itexamNonce
    } finally {
      _itexamNoncePending = null
    }
  })()
  return _itexamNoncePending
}

function _tokens(s) {
  return new Set(
    _itexamNorm(s)
      .split(" ")
      .filter((t) => t.length > 2),
  )
}

function _scoreMatch(candidateTitle, question) {
  const sa = _tokens(candidateTitle)
  const sb = _tokens(question)
  if (!sa.size || !sb.size) return { coverage: 0, jaccard: 0 }
  let hits = 0
  sa.forEach((t) => {
    if (sb.has(t)) hits++
  })
  // Coverage of the shorter set (handles question != candidate length).
  const coverage = hits / Math.min(sa.size, sb.size)
  const jaccard = hits / (sa.size + sb.size - hits)
  return { coverage, jaccard }
}

async function _itexamSuggestOnce(questionText, nonce) {
  const body = new URLSearchParams({
    action: "dwqa-auto-suggest-search-result",
    title: questionText,
    nonce: nonce || "",
  })
  const res = await fetch(ITEXAM_AUTOSUGGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: body.toString(),
    credentials: "omit",
  })
  if (!res.ok) throw new Error(`autosuggest HTTP ${res.status}`)
  const text = await res.text()
  if (text.trim() === "-1") return { invalidNonce: true }
  try {
    const json = JSON.parse(text)
    if (json && json.success && Array.isArray(json.data))
      return { data: json.data }
  } catch (e) {
    /* fallthrough */
  }
  return { data: [] }
}

async function _itexamSuggest(questionText) {
  let nonce = await _itexamGetNonce()
  let result = await _itexamSuggestOnce(questionText, nonce)
  if (result.invalidNonce) {
    nonce = await _itexamGetNonce(true)
    result = await _itexamSuggestOnce(questionText, nonce)
  }
  return result.data || []
}

function _parseCorrectFromHtml(html) {
  const ulRe = /<ul[^>]*>([\s\S]*?)<\/ul>/g
  const liRe = /<li([^>]*)>([\s\S]*?)<\/li>/g
  const strip = (s) =>
    s
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()

  // Recognize "this is the correct answer" by either the class marker OR
  // inline red-color styling that the site uses on some pages.
  const isCorrectLi = (attrs, inner) => {
    if (/correct_answer/i.test(attrs)) return true
    if (
      /style\s*=\s*["'][^"']*color\s*:\s*(?:#ff0000|#f00|red\b|rgb\(\s*255\s*,\s*0\s*,\s*0\s*\))/i.test(
        inner,
      )
    )
      return true
    return false
  }

  let m
  while ((m = ulRe.exec(html)) !== null) {
    const answers = []
    let li
    while ((li = liRe.exec(m[1])) !== null) {
      if (isCorrectLi(li[1], li[2])) {
        const t = strip(li[2])
        if (t) answers.push(t)
      }
    }
    if (answers.length) return answers // first <ul> with any correct marker wins
  }
  return []
}

async function _itexamFetchAnswers(url) {
  const res = await fetch(url, { credentials: "omit" })
  if (!res.ok) throw new Error(`question page HTTP ${res.status}`)
  const html = await res.text()
  return _parseCorrectFromHtml(html)
}

function _truncateForSearch(questionText) {
  // WP autosuggest behaves better on shorter queries; pick a meaningful 8-12 word window.
  const words = (questionText || "").trim().split(/\s+/)
  if (words.length <= 12) return null
  return words.slice(0, 12).join(" ")
}

async function _suggestAndScore(query, key) {
  const suggestions = await _itexamSuggest(query)
  if (!suggestions.length) return { suggestions, ranked: [], best: null }
  const ranked = suggestions.map((s) => {
    const { coverage, jaccard } = _scoreMatch(s.title, query)
    return { ...s, coverage, jaccard, exact: _itexamNorm(s.title) === key }
  })
  ranked.sort(
    (a, b) =>
      b.exact - a.exact || b.coverage - a.coverage || b.jaccard - a.jaccard,
  )
  return { suggestions, ranked, best: ranked[0] }
}

function _isAcceptable(best, n) {
  return (
    best &&
    (best.exact || best.coverage >= 0.6 || (n === 1 && best.coverage >= 0.4))
  )
}

async function lookupItexamAnswers(questionText) {
  const key = _itexamNorm(questionText)
  const diag = { query: questionText, key, tries: [] }
  if (!key) return { answers: null, diag }
  if (_itexamCache.has(key))
    return { answers: _itexamCache.get(key), diag: { ...diag, cached: true } }

  try {
    // Attempt 1: full question.
    let { suggestions, best } = await _suggestAndScore(questionText, key)
    diag.tries.push({
      query: questionText.slice(0, 100),
      count: suggestions.length,
      top: best
        ? {
            title: best.title.slice(0, 100),
            coverage: +best.coverage.toFixed(2),
            exact: best.exact,
          }
        : null,
    })

    // Attempt 2: truncated head if the full query missed or returned weak matches.
    if (!_isAcceptable(best, suggestions.length)) {
      const shortQ = _truncateForSearch(questionText)
      if (shortQ) {
        const r2 = await _suggestAndScore(shortQ, key)
        diag.tries.push({
          query: shortQ.slice(0, 100),
          count: r2.suggestions.length,
          top: r2.best
            ? {
                title: r2.best.title.slice(0, 100),
                coverage: +r2.best.coverage.toFixed(2),
                exact: r2.best.exact,
              }
            : null,
        })
        if (
          r2.best &&
          (r2.best.exact || r2.best.coverage >= r2.suggestions[0].coverage)
        ) {
          best = r2.best
          suggestions = r2.suggestions
        }
      }
    }

    if (!_isAcceptable(best, suggestions.length)) {
      console.log("[itexam] no match. diag:", JSON.stringify(diag))
      _itexamCache.set(key, null)
      return { answers: null, diag }
    }

    const answers = await _itexamFetchAnswers(best.url)
    if (!answers.length) {
      diag.noMarkupAt = best.url
      console.log("[itexam] page had no correct_answer markup:", best.url)
      _itexamCache.set(key, null)
      return { answers: null, diag }
    }
    diag.matchedUrl = best.url
    diag.matchedTitle = best.title
    console.log(
      `[itexam] matched "${best.title.slice(0, 80)}" → ${answers.length} answer(s).`,
    )
    _itexamCache.set(key, answers)
    return { answers, diag }
  } catch (e) {
    diag.error = String((e && e.message) || e)
    console.warn("[itexam] lookup failed:", diag.error)
    return { answers: null, diag }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (
    request &&
    request.action === "lookupItexam" &&
    typeof request.question === "string"
  ) {
    lookupItexamAnswers(request.question).then(
      (result) =>
        sendResponse({ ok: true, answers: result.answers, diag: result.diag }),
      (err) =>
        sendResponse({ ok: false, error: String((err && err.message) || err) }),
    )
    return true // keep the message channel open for async response
  }
  return false
})

chrome.commands.onCommand.addListener((command) => {
  if (command === "process-page-command") {
    console.log("Command received: process-page-command")
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        const tabId = tabs[0].id
        chrome.storage.sync.get(["showAnswers"], (result) => {
          let showAnswers = true
          if (typeof result.showAnswers === "boolean") {
            showAnswers = result.showAnswers
          }

          chrome.tabs.sendMessage(
            tabId,
            { action: "processPage", showAnswers: showAnswers },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Background Error: Could not send message to tab.",
                  chrome.runtime.lastError.message,
                )
              } else {
                console.log(
                  "Background: Message sent to tab, response:",
                  response,
                )
              }
            },
          )
        })
      } else {
        console.warn("Background: No active tab found.")
      }
    })
  }
})
