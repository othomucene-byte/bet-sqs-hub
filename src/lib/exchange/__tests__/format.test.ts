import { describe, expect, it } from "vitest";
import {
  estimatedCost,
  fillableQuantity,
  netProceeds,
  positionPnl,
  price,
  splitBook,
  type Level,
} from "../format";

const book: Level[] = [
  { side: "SELL", price: 105, quantity: 100, orders: 1 },
  { side: "SELL", price: 104, quantity: 50, orders: 1 },
  { side: "BUY", price: 102, quantity: 200, orders: 2 },
  { side: "BUY", price: 103, quantity: 30, orders: 1 },
];

describe("formatação de preços", () => {
  it("nunca inventa cotação quando não há dados", () => {
    expect(price(null)).toBe("Dados não disponíveis");
    expect(price(103.5)).toBe("103.50 MZN");
  });
});

describe("livro de ordens", () => {
  it("ordena compras por preço decrescente e vendas por preço crescente", () => {
    const { bids, asks } = splitBook(book);
    expect(bids.map((l) => l.price)).toEqual([103, 102]);
    expect(asks.map((l) => l.price)).toEqual([104, 105]);
  });

  it("limita a quantidade executável à liquidez existente", () => {
    expect(fillableQuantity(book, "BUY", 40)).toBe(40);
    expect(fillableQuantity(book, "BUY", 500)).toBe(150);
    expect(fillableQuantity(book, "SELL", 500)).toBe(230);
    expect(fillableQuantity([], "BUY", 10)).toBe(0);
  });
});

describe("custos e resultado", () => {
  it("inclui comissão na compra e desconta na venda", () => {
    expect(estimatedCost(10, 100, 0.0025)).toBe(1002.5);
    expect(netProceeds(10, 100, 0.0025)).toBe(997.5);
  });

  it("calcula lucro/prejuízo da posição", () => {
    expect(positionPnl(100, 100, 110)).toEqual({ value: 1000, pct: 10 });
    expect(positionPnl(100, 100, null)).toEqual({ value: null, pct: null });
  });
});
