// apps/mobile/src/speechPolyfill.ts
// Runs inside the web view before the site loads. Phone web views have no speech recognition, so this gives the
// site a window.SpeechRecognition that looks like Chrome's but asks the app (speechBridge.ts) to use the phone's
// own recognizer. The site's code (pronunciation scores, live captions, the AI partner) works unchanged.
//
// It is plain text, not a function: Hermes (the app's JavaScript engine) can't turn a function back into source.
//
// Messages to the app:   { channel: "sb-speech", action: "start" | "stop" | "abort", id, options? }
// Events from the app:   window.__sbSpeech.emit(id, type, payload)
//   type: start | audiostart | speechstart | speechend | audioend | result | nomatch | error | end
//   result payload: { isFinal, results: [{ transcript, confidence }] } (the alternatives for one phrase)
//   error payload:  { error, message }

export const SPEECH_POLYFILL = String.raw`
(function () {
  if (window.__sbSpeech || !window.ReactNativeWebView || window.SpeechRecognition || window.webkitSpeechRecognition) return;
  var instances = {};
  var nextId = 1;

  function post(message) {
    message.channel = "sb-speech";
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }

  function makeEvent(type, extra) {
    var event = new Event(type);
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        Object.defineProperty(event, key, { value: extra[key], enumerable: true });
      });
    }
    return event;
  }

  // Lists the site reads like arrays: results[i][0].transcript, results[i].isFinal, results.length, item(i)
  function list(items, extra) {
    var out = items.slice();
    out.item = function (i) { return out[i]; };
    if (extra) Object.keys(extra).forEach(function (key) { out[key] = extra[key]; });
    return out;
  }

  class SpeakBetterSpeechRecognition extends EventTarget {
    constructor() {
      super();
      this.lang = "en-US";
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;
      this.onstart = this.onend = this.onresult = this.onerror = this.onnomatch = null;
      this.onaudiostart = this.onaudioend = this.onspeechstart = this.onspeechend = null;
      this._id = String(nextId++);
      this._finals = [];
      this._running = false;
    }

    start() {
      if (this._running) throw new DOMException("Recognition has already started.", "InvalidStateError");
      this._running = true;
      this._finals = [];
      instances[this._id] = this;
      post({
        action: "start",
        id: this._id,
        options: {
          lang: this.lang || "en-US",
          continuous: !!this.continuous,
          interimResults: !!this.interimResults,
          maxAlternatives: Math.max(1, Number(this.maxAlternatives) || 1),
        },
      });
    }

    stop() {
      if (this._running) post({ action: "stop", id: this._id });
    }

    abort() {
      if (this._running) post({ action: "abort", id: this._id });
    }

    _fire(type, extra) {
      var event = makeEvent(type, extra);
      var handler = this["on" + type];
      if (typeof handler === "function") {
        try { handler.call(this, event); } catch (error) { setTimeout(function () { throw error; }); }
      }
      this.dispatchEvent(event);
    }

    _receive(type, payload) {
      payload = payload || {};
      if (type === "result") {
        var max = Math.max(1, Number(this.maxAlternatives) || 1);
        var alternatives = (payload.results || []).slice(0, max).map(function (r) {
          return { transcript: r.transcript || "", confidence: typeof r.confidence === "number" ? r.confidence : 0 };
        });
        if (!alternatives.length) return;
        var phrase = list(alternatives, { isFinal: !!payload.isFinal });
        var index = this._finals.length;
        var all = this._finals.concat([phrase]);
        if (payload.isFinal) this._finals.push(phrase);
        else if (!this.interimResults) return;
        this._fire("result", { resultIndex: index, results: list(all) });
      } else if (type === "error") {
        this._fire("error", { error: payload.error || "unknown", message: payload.message || "" });
      } else if (type === "end") {
        if (!this._running) return;
        this._running = false;
        delete instances[this._id];
        this._fire("end");
      } else {
        this._fire(type);
      }
    }
  }

  window.__sbSpeech = {
    emit: function (id, type, payload) {
      var recognition = instances[id];
      if (recognition) recognition._receive(type, payload);
    },
  };
  window.SpeechRecognition = SpeakBetterSpeechRecognition;
  window.webkitSpeechRecognition = SpeakBetterSpeechRecognition;
})();
true;
`;
