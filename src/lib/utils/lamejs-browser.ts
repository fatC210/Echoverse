type LameJsModule = {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
    encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
    flush: () => Int8Array;
  };
};

type LameJsGlobal = typeof globalThis & {
  __echoverseLameJs?: LameJsModule;
  __echoverseLameJsPromise?: Promise<LameJsModule>;
};

function getLameJsGlobal() {
  return globalThis as LameJsGlobal;
}

export async function loadLameJs() {
  if (typeof window === "undefined") {
    throw new Error("MP3 export is only available in the browser");
  }

  const globalScope = getLameJsGlobal();

  if (globalScope.__echoverseLameJs) {
    return globalScope.__echoverseLameJs;
  }

  if (!globalScope.__echoverseLameJsPromise) {
    globalScope.__echoverseLameJsPromise = fetch("/vendor/lame.all.js")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load MP3 encoder bundle (${response.status})`);
        }

        return response.text();
      })
      .then((source) => {
        const factory = new Function(`${source}\nreturn lamejs;`) as () => unknown;
        const loaded = factory() as Partial<LameJsModule> | undefined;

        if (typeof loaded?.Mp3Encoder !== "function") {
          throw new Error("MP3 encoder bundle did not expose Mp3Encoder");
        }

        globalScope.__echoverseLameJs = loaded as LameJsModule;
        return globalScope.__echoverseLameJs;
      })
      .catch((error) => {
        delete globalScope.__echoverseLameJsPromise;
        throw error;
      });
  }

  return globalScope.__echoverseLameJsPromise;
}
