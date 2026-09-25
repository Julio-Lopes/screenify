/** Captura padrão. A escolha de resolução e FPS pela interface entra na Fase 10 */
export const SCREEN_CAPTURE = {
  maxWidth: 1920,
  maxHeight: 1080,
  frameRate: 30,
  maxFrameRate: 60,
  maxBitrate: 5_000_000,
} as const;

/** Opções do Chrome/Edge que o TypeScript ainda não conhece. Navegadores que não as suportam ignoram */
interface ChromeDisplayMediaOptions extends DisplayMediaStreamOptions {
  selfBrowserSurface?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
  systemAudio?: 'include' | 'exclude';
}

export const DISPLAY_MEDIA_OPTIONS: ChromeDisplayMediaOptions = {
  video: {
    width: { max: SCREEN_CAPTURE.maxWidth },
    height: { max: SCREEN_CAPTURE.maxHeight },
    frameRate: { ideal: SCREEN_CAPTURE.frameRate, max: SCREEN_CAPTURE.maxFrameRate },
  },
  // Áudio do sistema é opcional no prompt e entra junto com as opções de qualidade
  audio: false,
  // Esconde a própria aba do Screenify da lista: compartilhá-la criaria um espelho infinito
  selfBrowserSurface: 'exclude',
  // Permite trocar de janela/aba sem parar a transmissão
  surfaceSwitching: 'include',
  systemAudio: 'exclude',
};