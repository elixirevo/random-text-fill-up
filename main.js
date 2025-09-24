// App state
const state = {
  originalText: '',
  maskMap: [], // boolean[] parallel to codepoints
  codepoints: [], // Array.from(originalText)
  totalMasked: 0,
}

const els = {
  sourceText: document.getElementById('sourceText'),
  maskRatio: document.getElementById('maskRatio'),
  maskRatioValue: document.getElementById('maskRatioValue'),
  maskMode: document.getElementById('maskMode'),
  btnGenerate: document.getElementById('btnGenerate'),
  btnRevealAll: document.getElementById('btnRevealAll'),
  btnReset: document.getElementById('btnReset'),
  renderArea: document.getElementById('renderArea'),
  stats: document.getElementById('stats'),
}

// Detect Unicode property escapes support
const supportsUnicodeProps = (() => {
  try {
    // eslint-disable-next-line no-new
    new RegExp('\\p{L}', 'u')
    return true
  } catch (_) {
    try {
      // Fallback check that actually compiles in environments with support
      // Some engines require a real property to validate
      // eslint-disable-next-line no-new
      new RegExp('\\p{L}', 'u')
      return true
    } catch (e) {
      return false
    }
  }
})()

function isMaskableChar(ch) {
  if (!ch) return false
  if (supportsUnicodeProps) {
    return /\p{L}|\p{N}/u.test(ch)
  }
  // Fallback: ASCII letters/numbers + Hangul range
  return /[A-Za-z0-9\uAC00-\uD7A3]/.test(ch)
}

function buildMaskChar(originalText, ratioPercent) {
  const codepoints = Array.from(originalText)
  const maskableIndexes = []
  for (let i = 0; i < codepoints.length; i += 1) {
    if (isMaskableChar(codepoints[i])) maskableIndexes.push(i)
  }

  const maskMap = new Array(codepoints.length).fill(false)
  const ratio = Math.max(0, Math.min(100, Number(ratioPercent))) / 100
  const rng = Math.random

  for (let i = 0; i < codepoints.length; i += 1) {
    const ch = codepoints[i]
    if (!isMaskableChar(ch)) continue
    if (rng() < ratio) maskMap[i] = true
  }

  // Ensure at least one masked char if possible
  const maskedCount = maskMap.filter(Boolean).length
  if (maskedCount === 0 && maskableIndexes.length > 0 && ratio > 0) {
    const pick = maskableIndexes[Math.floor(rng() * maskableIndexes.length)]
    maskMap[pick] = true
  }

  return { codepoints, maskMap }
}

function tokenizeWords(text) {
  const tokens = []
  let current = ''
  let isWord = null
  const arr = Array.from(text)
  const isWordChar = supportsUnicodeProps
    ? (ch) => /\p{L}|\p{N}/u.test(ch)
    : (ch) => /[A-Za-z0-9\uAC00-\uD7A3]/.test(ch)

  for (let i = 0; i < arr.length; i += 1) {
    const ch = arr[i]
    const w = isWordChar(ch)
    if (isWord === null) {
      isWord = w
      current = ch
      continue
    }
    if (w === isWord) {
      current += ch
    } else {
      tokens.push({ text: current, isWord })
      isWord = w
      current = ch
    }
  }
  if (current) tokens.push({ text: current, isWord: !!isWord })
  return tokens
}

function buildMaskWord(originalText, ratioPercent) {
  const tokens = tokenizeWords(originalText)
  const ratio = Math.max(0, Math.min(100, Number(ratioPercent))) / 100
  const rng = Math.random
  const maskMap = tokens.map((t) => (t.isWord ? rng() < ratio : false))
  // Ensure at least one masked word if possible
  const maskableIndexes = tokens.map((t, i) => (t.isWord ? i : -1)).filter((i) => i >= 0)
  const maskedCount = maskMap.filter(Boolean).length
  if (maskedCount === 0 && maskableIndexes.length > 0 && ratio > 0) {
    const pick = maskableIndexes[Math.floor(rng() * maskableIndexes.length)]
    maskMap[pick] = true
  }
  return { tokens, maskMap }
}

function clearNodeChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild)
}

function updateStats() {
  const inputs = els.renderArea.querySelectorAll('input.mask-input, input.word-input')
  const total = inputs.length
  let correct = 0
  inputs.forEach((inp) => {
    if (inp.classList.contains('correct')) correct += 1
  })
  els.stats.textContent = `정답 ${correct}/${total}`
}

function focusNextMasked(fromIndex) {
  const inputs = els.renderArea.querySelectorAll('input.mask-input, input.word-input')
  for (let i = 0; i < inputs.length; i += 1) {
    const idx = Number(inputs[i].dataset.idx)
    if (idx > fromIndex) {
      inputs[i].focus()
      return
    }
  }
}

function focusPrevMasked(fromIndex) {
  const inputs = els.renderArea.querySelectorAll('input.mask-input, input.word-input')
  for (let i = inputs.length - 1; i >= 0; i -= 1) {
    const idx = Number(inputs[i].dataset.idx)
    if (idx < fromIndex) {
      inputs[i].focus()
      return
    }
  }
}

function normalizeChar(value) {
  if (!value) return ''
  // Trim whitespace, keep first user-perceived char (roughly)
  const normalized = value.normalize('NFKC')
  return Array.from(normalized)[0] ?? ''
}

function compareChar(inputChar, answerChar) {
  if (!inputChar) return false
  // case-insensitive for letters, exact for others
  return inputChar.toLocaleLowerCase() === answerChar.toLocaleLowerCase()
}

function renderBoardChar(codepoints, maskMap) {
  clearNodeChildren(els.renderArea)
  const frag = document.createDocumentFragment()

  for (let i = 0; i < codepoints.length; i += 1) {
    const ch = codepoints[i]
    if (maskMap[i]) {
      const input = document.createElement('input')
      input.type = 'text'
      input.inputMode = 'text'
      input.autocomplete = 'off'
      input.autocapitalize = 'none'
      input.spellcheck = false
      input.maxLength = 1 // Hangul/ASCII ok
      input.dataset.answer = ch
      input.dataset.idx = String(i)
      input.className = 'mask-input token'

      let isComposing = false

      input.addEventListener('compositionstart', () => {
        isComposing = true
      })
      input.addEventListener('compositionend', (e) => {
        isComposing = false
        // After IME composition, evaluate the composed char
        const char = normalizeChar(e.target.value)
        e.target.value = char
        const ok = compareChar(char, e.target.dataset.answer)
        e.target.classList.toggle('correct', ok)
        e.target.classList.toggle('incorrect', !ok && char !== '')
        if (ok) focusNextMasked(Number(e.target.dataset.idx))
        updateStats()
      })

      input.addEventListener('input', (e) => {
        if (isComposing) return // wait until compositionend
        const char = normalizeChar(e.target.value)
        e.target.value = char
        const ok = compareChar(char, e.target.dataset.answer)
        e.target.classList.toggle('correct', ok)
        e.target.classList.toggle('incorrect', !ok && char !== '')
        if (ok) focusNextMasked(Number(e.target.dataset.idx))
        updateStats()
      })

      input.addEventListener('keydown', (e) => {
        const idx = Number(e.currentTarget.dataset.idx)
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          focusNextMasked(idx)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          focusPrevMasked(idx)
        } else if (e.key === 'Backspace' && e.currentTarget.value) {
          // clear value but don't navigate
          e.currentTarget.value = ''
          e.currentTarget.classList.remove('correct', 'incorrect')
          updateStats()
          e.preventDefault()
        }
      })

      input.addEventListener('paste', (e) => {
        e.preventDefault()
        const text = (e.clipboardData?.getData('text') ?? '').trim()
        if (!text) return
        const char = normalizeChar(text)
        input.value = char
        const ok = compareChar(char, input.dataset.answer)
        input.classList.toggle('correct', ok)
        input.classList.toggle('incorrect', !ok && char !== '')
        if (ok) focusNextMasked(Number(input.dataset.idx))
        updateStats()
      })

      frag.appendChild(input)
    } else {
      if (ch === '\n') {
        frag.appendChild(document.createElement('br'))
      } else {
        const span = document.createElement('span')
        span.textContent = ch
        span.className = 'literal token'
        frag.appendChild(span)
      }
    }
  }

  els.renderArea.appendChild(frag)

  // Focus first input if any
  const first = els.renderArea.querySelector('input.mask-input')
  if (first) first.focus()

  updateStats()
}

function renderBoardWord(tokens, maskMap) {
  clearNodeChildren(els.renderArea)
  const frag = document.createDocumentFragment()
  let caretIndex = -1

  const createWordInput = (answer, idx) => {
    const input = document.createElement('input')
    input.type = 'text'
    input.autocomplete = 'off'
    input.autocapitalize = 'none'
    input.spellcheck = false
    input.className = 'word-input token'
    input.placeholder = '____'
    input.dataset.answer = answer
    input.dataset.idx = String(idx)

    input.addEventListener('input', (e) => {
      const val = (e.target.value || '').trim()
      const ok = val.localeCompare(answer, undefined, { sensitivity: 'accent' }) === 0
      e.target.classList.toggle('correct', ok)
      e.target.classList.toggle('incorrect', !ok && val.length > 0)
      if (ok) {
        e.target.value = answer
        focusNextMasked(Number(e.target.dataset.idx))
      }
      updateStats()
    })

    input.addEventListener('keydown', (e) => {
      const idx = Number(e.currentTarget.dataset.idx)
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        focusNextMasked(idx)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        focusPrevMasked(idx)
      } else if (e.key === 'Backspace' && e.currentTarget.value) {
        e.currentTarget.classList.remove('correct', 'incorrect')
      }
    })

    return input
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]
    if (maskMap[i]) {
      const input = createWordInput(t.text, i)
      if (caretIndex === -1) caretIndex = i
      frag.appendChild(input)
    } else {
      if (t.text === '\n') {
        frag.appendChild(document.createElement('br'))
      } else {
        const span = document.createElement('span')
        span.textContent = t.text
        span.className = 'literal token'
        frag.appendChild(span)
      }
    }
  }

  els.renderArea.appendChild(frag)
  const first = els.renderArea.querySelector('input.word-input')
  if (first) first.focus()
  updateStats()
}

function generate() {
  state.originalText = els.sourceText.value ?? ''
  const ratio = Number(els.maskRatio.value)
  const mode = els.maskMode?.value || 'char'
  if (mode === 'word') {
    const { tokens, maskMap } = buildMaskWord(state.originalText, ratio)
    state.codepoints = []
    state.maskMap = maskMap
    state.totalMasked = maskMap.filter(Boolean).length
    renderBoardWord(tokens, maskMap)
  } else {
    const { codepoints, maskMap } = buildMaskChar(state.originalText, ratio)
    state.codepoints = codepoints
    state.maskMap = maskMap
    state.totalMasked = maskMap.filter(Boolean).length
    renderBoardChar(codepoints, maskMap)
  }
}

function revealAll() {
  const charInputs = els.renderArea.querySelectorAll('input.mask-input')
  const wordInputs = els.renderArea.querySelectorAll('input.word-input')
  charInputs.forEach((inp) => {
    inp.value = inp.dataset.answer ?? ''
    inp.classList.add('correct')
    inp.classList.remove('incorrect')
  })
  wordInputs.forEach((inp) => {
    const ans = inp.dataset.answer ?? ''
    inp.value = ans
    inp.classList.add('correct')
    inp.classList.remove('incorrect')
  })
  updateStats()
}

function resetAll() {
  state.originalText = ''
  state.maskMap = []
  state.codepoints = []
  state.totalMasked = 0
  els.sourceText.value = ''
  els.maskRatio.value = '30'
  els.maskRatioValue.textContent = '30%'
  clearNodeChildren(els.renderArea)
  els.stats.textContent = '정답 0/0'
}

function init() {
  els.maskRatio.addEventListener('input', () => {
    els.maskRatioValue.textContent = `${els.maskRatio.value}%`
  })

  els.btnGenerate.addEventListener('click', generate)
  els.btnRevealAll.addEventListener('click', revealAll)
  els.btnReset.addEventListener('click', resetAll)
  els.maskMode?.addEventListener('change', () => {
    if (state.originalText) generate()
  })

  // Fill with demo text for convenience
  if (!els.sourceText.value) {
    els.sourceText.value =
      '오늘은 날씨가 맑고, 기분이 아주 좋습니다.\n새로운 것을 배우기에 딱 좋은 날이에요!'
  }
}

init()
