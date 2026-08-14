//#region src/index.ts
var e = class {
	worker = null;
	isReady = !1;
	pendingOperations = /* @__PURE__ */ new Map();
	operationCounter = 0;
	workerUrl;
	wasmUrl;
	initTimeout;
	operationTimeout;
	initPromise;
	constructor(e = {}) {
		this.workerUrl = e.workerUrl, this.wasmUrl = e.wasmUrl, this.initTimeout = e.initTimeout || 1e4, this.operationTimeout = e.operationTimeout || 3e4, this.initPromise = this.initialize();
	}
	async initialize() {
		if (!this.isReady) return new Promise((e, t) => {
			try {
				let n;
				n = this.workerUrl ? this.workerUrl : new URL("data:video/mp2t;base64,Ly8gV2ViIFdvcmtlciBmb3IgbGliaW1hZ2VxdWFudCBXQVNNIG1vZHVsZQovLyBJbXBvcnQgd2lsbCBiZSBkb25lIGR5bmFtaWNhbGx5IGF0IHJ1bnRpbWUKCmltcG9ydCB0eXBlIHsgUXVhbnRpemF0aW9uT3B0aW9ucyB9IGZyb20gIi4iOwoKCnR5cGUgV29ya2VyTWVzc2FnZSA9IHsKICBpZDogbnVtYmVyOwogIGFjdGlvbjogJ3F1YW50aXplX3BuZyc7CiAgZGF0YTogUG5nUXVhbnRpemF0aW9uRGF0YTsKfSB8IHsKICBpZDogbnVtYmVyOwogIGFjdGlvbjogJ3F1YW50aXplX2ltYWdlZGF0YSc7CiAgZGF0YTogSW1hZ2VEYXRhUXVhbnRpemF0aW9uRGF0YTsKCn0KCmludGVyZmFjZSBDb25maWd1cmVNZXNzYWdlIHsKICB0eXBlOiAiY29uZmlndXJlIjsKICB3YXNtVXJsOiBzdHJpbmc7Cn0KCmludGVyZmFjZSBQbmdRdWFudGl6YXRpb25EYXRhIHsKICBwbmdCeXRlczogbnVtYmVyW107CiAgb3B0aW9ucz86IFF1YW50aXphdGlvbk9wdGlvbnM7Cn0KCmludGVyZmFjZSBJbWFnZURhdGFRdWFudGl6YXRpb25EYXRhIHsKICBpbWFnZURhdGE6IG51bWJlcltdOwogIHdpZHRoOiBudW1iZXI7CiAgaGVpZ2h0OiBudW1iZXI7CiAgb3B0aW9ucz86IFF1YW50aXphdGlvbk9wdGlvbnM7Cn0KCmxldCBpc0luaXRpYWxpemVkOiBib29sZWFuID0gZmFsc2U7CmxldCB3YXNtTW9kdWxlOiBhbnkgPSBudWxsOwpsZXQgY3VzdG9tV2FzbVVybDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkOwoKLy8gSW5pdGlhbGl6ZSBXQVNNIG1vZHVsZQphc3luYyBmdW5jdGlvbiBpbml0aWFsaXplV2FzbSgpOiBQcm9taXNlPGJvb2xlYW4+IHsKICBpZiAoIWlzSW5pdGlhbGl6ZWQpIHsKICAgIC8vIEluaXRpYWxpemUgdGhlIFdBU00gbW9kdWxlCiAgICBjb25zdCB3YXNtTG9hZGVyUGF0aCA9IG5ldyBVUkwoIi4vd2FzbS9saWJpbWFnZXF1YW50X3dhc20uanMiLCBpbXBvcnQubWV0YS51cmwpLmhyZWY7CiAgICB3YXNtTW9kdWxlID0gYXdhaXQgaW1wb3J0KHdhc21Mb2FkZXJQYXRoKTsKICAgIC8vIFVzZSBjdXN0b20gV0FTTSBVUkwgaWYgcHJvdmlkZWQsIG90aGVyd2lzZSB1c2UgZGVmYXVsdCByZWxhdGl2ZSBwYXRoCiAgICBhd2FpdCB3YXNtTW9kdWxlLmRlZmF1bHQoY3VzdG9tV2FzbVVybCk7CiAgICBpc0luaXRpYWxpemVkID0gdHJ1ZTsKICB9CiAgcmV0dXJuIHRydWU7Cn0KCi8vIE1lc3NhZ2UgaGFuZGxlciBmb3Igd29ya2VyCnNlbGYub25tZXNzYWdlID0gYXN5bmMgZnVuY3Rpb24gKAogIGU6IE1lc3NhZ2VFdmVudDxXb3JrZXJNZXNzYWdlIHwgQ29uZmlndXJlTWVzc2FnZT4KKSB7CiAgY29uc3QgbWVzc2FnZSA9IGUuZGF0YTsKCiAgLy8gSGFuZGxlIGNvbmZpZ3VyYXRpb24gbWVzc2FnZQogIGlmICgidHlwZSIgaW4gbWVzc2FnZSAmJiBtZXNzYWdlLnR5cGUgPT09ICJjb25maWd1cmUiKSB7CiAgICBjdXN0b21XYXNtVXJsID0gbWVzc2FnZS53YXNtVXJsOwogICAgcmV0dXJuOwogIH0KCiAgLy8gSGFuZGxlIHJlZ3VsYXIgb3BlcmF0aW9uIG1lc3NhZ2VzCiAgY29uc3QgeyBpZCwgYWN0aW9uLCBkYXRhIH0gPSBtZXNzYWdlIGFzIFdvcmtlck1lc3NhZ2U7CgogIHRyeSB7CiAgICAvLyBFbnN1cmUgV0FTTSBpcyBpbml0aWFsaXplZAogICAgYXdhaXQgaW5pdGlhbGl6ZVdhc20oKTsKCiAgICBsZXQgcmVzdWx0OwoKICAgIHN3aXRjaCAoYWN0aW9uKSB7CiAgICAgIGNhc2UgInF1YW50aXplX3BuZyI6CiAgICAgICAgcmVzdWx0ID0gYXdhaXQgcXVhbnRpemVQbmcoZGF0YSk7CiAgICAgICAgYnJlYWs7CiAgICAgIGNhc2UgInF1YW50aXplX2ltYWdlZGF0YSI6CiAgICAgICAgcmVzdWx0ID0gYXdhaXQgcXVhbnRpemVJbWFnZURhdGEoZGF0YSk7CiAgICAgICAgYnJlYWs7CiAgICAgIGRlZmF1bHQ6CiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGFjdGlvbjogJHthY3Rpb259YCk7CiAgICB9CgogICAgLy8gU2VuZCBzdWNjZXNzIHJlc3BvbnNlCiAgICBzZWxmLnBvc3RNZXNzYWdlKHsKICAgICAgaWQsCiAgICAgIHN1Y2Nlc3M6IHRydWUsCiAgICAgIHJlc3VsdCwKICAgIH0pOwogIH0gY2F0Y2ggKGVycm9yKSB7CiAgICAvLyBTZW5kIGVycm9yIHJlc3BvbnNlCiAgICBzZWxmLnBvc3RNZXNzYWdlKHsKICAgICAgaWQsCiAgICAgIHN1Y2Nlc3M6IGZhbHNlLAogICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAiVW5rbm93biBlcnJvciBvY2N1cnJlZCIsCiAgICB9KTsKICB9Cn07Cgphc3luYyBmdW5jdGlvbiBxdWFudGl6ZVBuZyhkYXRhOiBQbmdRdWFudGl6YXRpb25EYXRhKSB7CiAgY29uc3QgeyBwbmdCeXRlcywgb3B0aW9ucyA9IHt9IH0gPSBkYXRhOwoKICAvLyBDb252ZXJ0IFBORyBieXRlcyB0byBVaW50OEFycmF5CiAgY29uc3QgcG5nRGF0YSA9IG5ldyBVaW50OEFycmF5KHBuZ0J5dGVzKTsKCiAgLy8gRGVjb2RlIFBORyB0byBSR0JBCiAgY29uc3QgZGVjb2RlZFJlc3VsdCA9IHdhc21Nb2R1bGUuZGVjb2RlX3BuZ190b19yZ2JhKHBuZ0RhdGEpOwogIGNvbnN0IHJnYmFEYXRhID0gZGVjb2RlZFJlc3VsdFswXTsgLy8gVWludDhDbGFtcGVkQXJyYXkKICBjb25zdCB3aWR0aCA9IGRlY29kZWRSZXN1bHRbMV07CiAgY29uc3QgaGVpZ2h0ID0gZGVjb2RlZFJlc3VsdFsyXTsKCiAgcmV0dXJuIGF3YWl0IHF1YW50aXplUmdiYURhdGEocmdiYURhdGEsIHdpZHRoLCBoZWlnaHQsIG9wdGlvbnMpOwp9Cgphc3luYyBmdW5jdGlvbiBxdWFudGl6ZUltYWdlRGF0YShkYXRhOiBJbWFnZURhdGFRdWFudGl6YXRpb25EYXRhKSB7CiAgY29uc3QgeyBpbWFnZURhdGEsIHdpZHRoLCBoZWlnaHQsIG9wdGlvbnMgPSB7fSB9ID0gZGF0YTsKCiAgLy8gQ29udmVydCB0byBVaW50OENsYW1wZWRBcnJheQogIGNvbnN0IHJnYmFEYXRhID0gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KGltYWdlRGF0YSk7CgogIHJldHVybiBhd2FpdCBxdWFudGl6ZVJnYmFEYXRhKHJnYmFEYXRhLCB3aWR0aCwgaGVpZ2h0LCBvcHRpb25zKTsKfQoKYXN5bmMgZnVuY3Rpb24gcXVhbnRpemVSZ2JhRGF0YSgKICByZ2JhRGF0YTogVWludDhDbGFtcGVkQXJyYXksCiAgd2lkdGg6IG51bWJlciwKICBoZWlnaHQ6IG51bWJlciwKICBvcHRpb25zOiBRdWFudGl6YXRpb25PcHRpb25zCikgewogIC8vIENyZWF0ZSBxdWFudGl6ZXIgaW5zdGFuY2UKICBjb25zdCBxdWFudGl6ZXIgPSBuZXcgd2FzbU1vZHVsZS5JbWFnZVF1YW50aXplcigpOwoKICB0cnkgewogICAgLy8gQXBwbHkgb3B0aW9ucwogICAgaWYgKG9wdGlvbnMuc3BlZWQgIT09IHVuZGVmaW5lZCkgewogICAgICBxdWFudGl6ZXIuc2V0U3BlZWQob3B0aW9ucy5zcGVlZCk7CiAgICB9CgogICAgaWYgKG9wdGlvbnMucXVhbGl0eSAhPT0gdW5kZWZpbmVkKSB7CiAgICAgIGNvbnN0IHsgbWluID0gMCwgdGFyZ2V0ID0gMTAwIH0gPSBvcHRpb25zLnF1YWxpdHk7CiAgICAgIHF1YW50aXplci5zZXRRdWFsaXR5KG1pbiwgdGFyZ2V0KTsKICAgIH0KCiAgICBpZiAob3B0aW9ucy5tYXhDb2xvcnMgIT09IHVuZGVmaW5lZCkgewogICAgICBxdWFudGl6ZXIuc2V0TWF4Q29sb3JzKG9wdGlvbnMubWF4Q29sb3JzKTsKICAgIH0KCiAgICBpZiAob3B0aW9ucy5wb3N0ZXJpemF0aW9uICE9PSB1bmRlZmluZWQpIHsKICAgICAgcXVhbnRpemVyLnNldFBvc3Rlcml6YXRpb24ob3B0aW9ucy5wb3N0ZXJpemF0aW9uKTsKICAgIH0KCiAgICAvLyBRdWFudGl6ZSB0aGUgaW1hZ2UKICAgIGNvbnN0IHF1YW50UmVzdWx0ID0gcXVhbnRpemVyLnF1YW50aXplSW1hZ2UocmdiYURhdGEsIHdpZHRoLCBoZWlnaHQpOwoKICAgIHRyeSB7CiAgICAgIC8vIEV4dHJhY3QgcmVzdWx0cwogICAgICBjb25zdCBwYWxldHRlID0gcXVhbnRSZXN1bHQuZ2V0UGFsZXR0ZSgpOwogICAgICBjb25zdCBxdWFsaXR5ID0gcXVhbnRSZXN1bHQuZ2V0UXVhbnRpemF0aW9uUXVhbGl0eSgpOwogICAgICBjb25zdCBwYWxldHRlTGVuZ3RoID0gcXVhbnRSZXN1bHQuZ2V0UGFsZXR0ZUxlbmd0aCgpOwoKICAgICAgLy8gU2V0IGRpdGhlcmluZyBpZiBzcGVjaWZpZWQKICAgICAgaWYgKG9wdGlvbnMuZGl0aGVyaW5nICE9PSB1bmRlZmluZWQpIHsKICAgICAgICBxdWFudFJlc3VsdC5zZXREaXRoZXJpbmcob3B0aW9ucy5kaXRoZXJpbmcpOwogICAgICB9CgogICAgICAvLyBHZXQgcGFsZXR0ZSBpbmRpY2VzIChzaW5nbGUgcmVtYXAgb3BlcmF0aW9uKQogICAgICBjb25zdCBwYWxldHRlSW5kaWNlcyA9IHF1YW50UmVzdWx0LmdldFBhbGV0dGVJbmRpY2VzKHJnYmFEYXRhLCB3aWR0aCwgaGVpZ2h0KTsKCiAgICAgIC8vIFJlY29uc3RydWN0IFJHQkEgZGF0YSBmcm9tIHBhbGV0dGUgKyBpbmRpY2VzIChhdm9pZHMgYSBzZWNvbmQgcmVtYXApCiAgICAgIGNvbnN0IHBpeGVsQ291bnQgPSB3aWR0aCAqIGhlaWdodDsKICAgICAgY29uc3QgcmVtYXBwZWREYXRhID0gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KHBpeGVsQ291bnQgKiA0KTsKICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwaXhlbENvdW50OyBpKyspIHsKICAgICAgICBjb25zdCBjb2xvciA9IHBhbGV0dGVbcGFsZXR0ZUluZGljZXNbaV1dOwogICAgICAgIGNvbnN0IG9mZnNldCA9IGkgKiA0OwogICAgICAgIHJlbWFwcGVkRGF0YVtvZmZzZXRdID0gY29sb3JbMF07CiAgICAgICAgcmVtYXBwZWREYXRhW29mZnNldCArIDFdID0gY29sb3JbMV07CiAgICAgICAgcmVtYXBwZWREYXRhW29mZnNldCArIDJdID0gY29sb3JbMl07CiAgICAgICAgcmVtYXBwZWREYXRhW29mZnNldCArIDNdID0gY29sb3JbM107CiAgICAgIH0KCiAgICAgIC8vIEdlbmVyYXRlIGluZGV4ZWQgUE5HCiAgICAgIGNvbnN0IHBuZ0J5dGVzID0gd2FzbU1vZHVsZS5lbmNvZGVfcGFsZXR0ZV90b19wbmcoCiAgICAgICAgcGFsZXR0ZUluZGljZXMsCiAgICAgICAgcGFsZXR0ZSwKICAgICAgICB3aWR0aCwKICAgICAgICBoZWlnaHQKICAgICAgKTsKCiAgICAgIC8vIEdlbmVyYXRlIEltYWdlRGF0YQogICAgICBjb25zdCBpbWFnZURhdGEgPSBuZXcgSW1hZ2VEYXRhKHJlbWFwcGVkRGF0YSwgd2lkdGgsIGhlaWdodCk7CgogICAgICByZXR1cm4gewogICAgICAgIHBhbGV0dGUsCiAgICAgICAgcG5nQnl0ZXMsCiAgICAgICAgaW1hZ2VEYXRhLAogICAgICAgIHF1YWxpdHksCiAgICAgICAgcGFsZXR0ZUxlbmd0aCwKICAgICAgICB3aWR0aCwKICAgICAgICBoZWlnaHQsCiAgICAgIH07CiAgICB9IGZpbmFsbHkgewogICAgICBxdWFudFJlc3VsdC5mcmVlKCk7CiAgICB9CiAgfSBmaW5hbGx5IHsKICAgIHF1YW50aXplci5mcmVlKCk7CiAgfQp9CgovLyBTZW5kIHJlYWR5IG1lc3NhZ2Ugd2hlbiB3b3JrZXIgaXMgbG9hZGVkCnNlbGYucG9zdE1lc3NhZ2UoeyB0eXBlOiAicmVhZHkiIH0pOwo=", "" + import.meta.url).href, this.worker = new Worker(n, { type: "module" });
				let r = setTimeout(() => {
					this.isReady || (this.worker && (this.worker.onerror = null), t(/* @__PURE__ */ Error("Worker initialization timeout")));
				}, this.initTimeout);
				this.worker.onmessage = (t) => {
					let { type: n, id: i, success: a, result: o, error: s } = t.data;
					if (n === "ready") {
						this.wasmUrl && this.worker?.postMessage({
							type: "configure",
							wasmUrl: this.wasmUrl
						}), this.isReady = !0, clearTimeout(r), e();
						return;
					}
					let c = this.pendingOperations.get(i);
					c && (this.pendingOperations.delete(i), clearTimeout(c.timer), a ? c.resolve(o) : c.reject(Error(s)));
				}, this.worker.onerror = (e) => {
					e.preventDefault(), clearTimeout(r), t(/* @__PURE__ */ Error(`Worker error: ${e.message}`));
				};
			} catch (e) {
				t(e);
			}
		});
	}
	async sendMessage(e, t) {
		return await this.initPromise, new Promise((n, r) => {
			let i = ++this.operationCounter, a = setTimeout(() => {
				this.pendingOperations.has(i) && (this.pendingOperations.delete(i), r(/* @__PURE__ */ Error("Operation timeout")));
			}, this.operationTimeout);
			this.pendingOperations.set(i, {
				resolve: n,
				reject: r,
				timer: a
			}), this.worker?.postMessage({
				id: i,
				action: e,
				data: t
			});
		});
	}
	async quantizePng(e, t = {}) {
		let n;
		if (e instanceof Blob) {
			let t = await e.arrayBuffer();
			n = new Uint8Array(t);
		} else n = e instanceof ArrayBuffer ? new Uint8Array(e) : e;
		return this.sendMessage("quantize_png", {
			pngBytes: Array.from(n),
			options: t
		});
	}
	async quantizeImageData(e, t = {}) {
		return this.sendMessage("quantize_imagedata", {
			imageData: Array.from(e.data),
			width: e.width,
			height: e.height,
			options: t
		});
	}
	dispose() {
		for (let [, e] of this.pendingOperations) clearTimeout(e.timer), e.reject(/* @__PURE__ */ Error("LibImageQuant disposed"));
		this.pendingOperations.clear(), this.worker &&= (this.worker.terminate(), null), this.isReady = !1, this.initPromise.catch(() => {});
	}
};
//#endregion
export { e as default };

//# sourceMappingURL=index.mjs.map