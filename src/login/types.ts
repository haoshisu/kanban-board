export type LoginInput = {
 email: string;
 password: string;
};

export type AuthUser = {
 id: string;
 email: string;
 name: string;
 loggedInAt: string;
};

export type LoginResult = {
 success: boolean;
 message: string;
 type: string;
};
