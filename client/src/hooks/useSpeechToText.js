import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Cleans up a raw speech-recognition transcript chunk: trims stray
 * whitespace and capitalizes the first letter. The browser's recognizer
 * decides word spelling/choice — this only tidies presentation, since
 * nothing client-side can improve on the recognizer's own accuracy.
 */
function tidyTranscript(text) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/**
 * Wraps the browser's built-in SpeechRecognition (Web Speech API).
 * 100% free, no server round trip, no API key — but only implemented in
 * Chromium-based browsers (Chrome, Edge, Opera, Brave). Firefox and Safari
 * don't ship a recognizer at all, so `supported` is false there and callers
 * should hide the mic button rather than show one that can't work.
 *
 * onResult(text, isFinal) fires as the user talks — `text` is the tidied
 * transcript for the current utterance, `isFinal` tells the caller whether
 * to append-and-lock it or keep treating it as a live preview.
 */
export function useSpeechToText({ onResult, lang } = {}) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState(null)
  const [interimText, setInterimText] = useState('')

  const recognitionRef = useRef(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  // Tracks whether the user *wants* to be listening, separate from the
  // browser engine's own listening state — Chrome silently ends recognition
  // after a stretch of silence even with continuous:true, so onend needs to
  // know whether that was an intentional stop or a restart is called for.
  const shouldListenRef = useRef(false)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    // Browser's own UI locale is usually the best guess for accent/vocabulary
    // unless the caller asks for something specific.
    recognition.lang = lang || navigator.language || 'en-US'

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTranscript += transcript
        else interimTranscript += transcript
      }
      setInterimText(interimTranscript)
      if (finalTranscript) {
        const cleaned = tidyTranscript(finalTranscript)
        if (cleaned) onResultRef.current?.(cleaned, true)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return // benign — pause or manual stop
      const messages = {
        'not-allowed': 'Microphone access was blocked. Allow microphone access in your browser to use voice input.',
        'audio-capture': 'No microphone was found. Connect a microphone and try again.',
        network: 'Voice input needs an internet connection to work.'
      }
      setError(messages[event.error] || `Voice input error: ${event.error}`)
      shouldListenRef.current = false
      setListening(false)
    }

    recognition.onend = () => {
      setInterimText('')
      // The engine stopped on its own (silence timeout) but the user hasn't
      // pressed stop — pick straight back up instead of quietly going idle.
      if (shouldListenRef.current) {
        try {
          recognition.start()
          return
        } catch {
          // fall through to marking not-listening
        }
      }
      setListening(false)
    }

    recognitionRef.current = recognition
    return () => {
      shouldListenRef.current = false
      recognition.stop()
    }
  }, [lang])

  const start = useCallback(() => {
    if (!recognitionRef.current) return
    setError(null)
    shouldListenRef.current = true
    try {
      recognitionRef.current.start()
      setListening(true)
    } catch {
      // start() throws if already started — ignore, it's already running.
    }
  }, [])

  const stop = useCallback(() => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { supported, listening, error, interimText, start, stop, toggle }
}
