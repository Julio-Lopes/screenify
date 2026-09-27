/**
 * Import dinâmico da página da sala. Fica num módulo próprio para a Home poder pré-carregá-la
 * sem importar o roteador (que importa a Home: seria uma dependência circular).
 */
export const loadRoomPage = () => import('./RoomPage');