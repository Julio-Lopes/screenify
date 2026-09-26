import { useEffect, useState, type RefObject } from 'react';
import { videoContentRect, type Rect } from './geometry';

/**
 * Área da imagem dentro do <video>, sempre atualizada: muda quando o elemento muda de tamanho
 * (janela, painel, tela cheia) e quando a resolução da transmissão muda sem o elemento mudar.
 * A camada de desenho e a de cursores se posicionam por ela.
 */
export function useVideoContentRect(videoRef: RefObject<HTMLVideoElement | null>): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => {
      const next = videoContentRect(video);
      setRect((current) =>
        current &&
        current.x === next.x &&
        current.y === next.y &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(video);
    video.addEventListener('resize', update);
    video.addEventListener('loadedmetadata', update);

    return () => {
      observer.disconnect();
      video.removeEventListener('resize', update);
      video.removeEventListener('loadedmetadata', update);
    };
  }, [videoRef]);

  return rect;
}