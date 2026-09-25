export interface PublicUser {
  id: string;
  displayName: string;
}

export interface CreateGuestRequest {
  displayName: string;
}

export interface GuestSessionResponse {
  user: PublicUser;
  token: string;
}