import { captureConstraints, type SharePreset } from './quality-presets';

/** Opções do Chrome/Edge que o TypeScript ainda não conhece. Navegadores que não as suportam ignoram */
interface ChromeDisplayMediaOptions extends DisplayMediaStreamOptions {
  selfBrowserSurface?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
  systemAudio?: 'include' | 'exclude';
}

export function displayMediaOptions(preset: SharePreset): ChromeDisplayMediaOptions {
  return {
    video: captureConstraints(preset),
    // Áudio do sistema é opcional no prompt e fica para uma fase própria
    audio: false,
    // Esconde a própria aba do Screenify da lista: compartilhá-la criaria um espelho infinito
    selfBrowserSurface: 'exclude',
    // Permite trocar de janela/aba sem parar a transmissão
    surfaceSwitching: 'include',
    systemAudio: 'exclude',
  };
} 