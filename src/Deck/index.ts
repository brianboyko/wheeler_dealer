import range from "lodash/range";
import Card from "./Card";

export const DECK = range(52).map((val: number) => new Card(val));
export const freshDeck = () => DECK.slice();
export default DECK;