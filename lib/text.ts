/** "Harbor Kids" -> "Harbor Kids'", "Sunflower Valley" -> "Sunflower Valley's". */
export const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);
