import { createContext } from 'react';

export const defaultUser = {
    username: "",
    email: "",
};

export const MyContext = createContext({
    currentUser: defaultUser,
    setCurrentUser: () => {},
});