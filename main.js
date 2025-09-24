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

function buildMask(originalText, ratioPercent) {
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

function clearNodeChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild)
}

function updateStats() {
  const inputs = els.renderArea.querySelectorAll('input.mask-input')
  const total = inputs.length
  let correct = 0
  inputs.forEach((inp) => {
    if (inp.classList.contains('correct')) correct += 1
  })
  els.stats.textContent = `정답 ${correct}/${total}`
}

function focusNextMasked(fromIndex) {
  const inputs = els.renderArea.querySelectorAll('input.mask-input')
  for (let i = 0; i < inputs.length; i += 1) {
    const idx = Number(inputs[i].dataset.idx)
    if (idx > fromIndex) {
      inputs[i].focus()
      return
    }
  }
}

function focusPrevMasked(fromIndex) {
  const inputs = els.renderArea.querySelectorAll('input.mask-input')
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

function renderBoard(codepoints, maskMap) {
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

function generate() {
  state.originalText = els.sourceText.value ?? ''
  const ratio = Number(els.maskRatio.value)
  const { codepoints, maskMap } = buildMask(state.originalText, ratio)
  state.codepoints = codepoints
  state.maskMap = maskMap
  state.totalMasked = maskMap.filter(Boolean).length
  renderBoard(codepoints, maskMap)
}

function revealAll() {
  const inputs = els.renderArea.querySelectorAll('input.mask-input')
  inputs.forEach((inp) => {
    inp.value = inp.dataset.answer ?? ''
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

  // Fill with demo text for convenience
  if (!els.sourceText.value) {
    els.sourceText.value =
      '오늘은 날씨가 맑고, 기분이 아주 좋습니다.\n새로운 것을 배우기에 딱 좋은 날이에요!'
  }
}

init()
