export function detectSpeakers(text, analysts) {
  const patterns = [
    /^([A-Z][a-zA-Z\u00C0-\u024F\u05D0-\u05EA]+(?:\s[A-Z][a-zA-Z\u00C0-\u024F\u05D0-\u05EA]+)?)\s*:/gm,
    /^\[([A-Z][a-zA-Z\u00C0-\u024F]+(?:\s[A-Z][a-zA-Z\u00C0-\u024F]+)?)\]/gm,
    /^([A-Z][a-zA-Z\u00C0-\u024F]+(?:\s[A-Z][a-zA-Z\u00C0-\u024F]+)?)\s+-\s/gm,
  ]
  const found = new Set()
  patterns.forEach(re => {
    let m
    while ((m = re.exec(text)) !== null) found.add(m[1].trim())
  })
  return [...found].map(rawName => {
    const lower = rawName.toLowerCase()
    const match = analysts.find(a => {
      const aLower = a.name.toLowerCase()
      return (
        aLower === lower ||
        aLower.startsWith(lower) ||
        lower.startsWith(aLower) ||
        a.initials.toLowerCase() === lower ||
        aLower.split(' ')[0] === lower.split(' ')[0]
      )
    })
    return { raw: rawName, analyst: match || null, active: !!match }
  })
}
