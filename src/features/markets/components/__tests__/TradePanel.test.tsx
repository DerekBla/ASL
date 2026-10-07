import type { ReactElement } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTradePanelStore } from "@/lib/stores/trade-panel-store";

import { makeMarketView, makeMyMarket } from "@/test/factories/market-view";

import { placeTrade } from "../../actions/place-trade";
import { TradePanel } from "../TradePanel";

vi.mock("../../actions/place-trade", () => ({ placeTrade: vi.fn() }));

function renderPanel(ui: ReactElement): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(placeTrade).mockReset();
  act(() => useTradePanelStore.getState().reset());
});

describe("TradePanel", () => {
  it("asks signed-out visitors to sign in", () => {
    renderPanel(
      <TradePanel
        market={makeMarketView()}
        me={makeMyMarket({ signedIn: false })}
        signInHref="/sign-in"
      />,
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByRole("form", { name: "Trade" })).not.toBeInTheDocument();
  });

  it("says so when trading has closed", () => {
    renderPanel(
      <TradePanel
        market={makeMarketView({ status: "closed" })}
        me={makeMyMarket()}
        signInHref="/sign-in"
      />,
    );
    expect(screen.getByText("Trading has closed on this market.")).toBeInTheDocument();
  });

  it("previews a buy before submitting it", () => {
    renderPanel(<TradePanel market={makeMarketView()} me={makeMyMarket()} signInHref="/sign-in" />);
    expect(screen.getByRole("button", { name: "Buy Rush" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Minerals to spend"), { target: { value: "5" } });
    expect(
      screen.getByText(/shares of Rush for 5 minerals\. Price moves to 70%/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy Rush" })).toBeEnabled();
  });

  it("sends the trade with a slippage bound and an idempotency key, then shows the receipt", async () => {
    vi.mocked(placeTrade).mockResolvedValue({
      data: {
        tradeId: 1 as never,
        marketId: 1 as never,
        marketSlug: "asl-s22-final-rush-vs-soulkey",
        outcomeIdx: 1,
        shares: 8.4,
        cost: 5,
        priceBefore: 0.5,
        priceAfter: 0.7,
        balance: 95,
        prices: [0.3, 0.7],
        replayed: false,
      },
    });
    renderPanel(<TradePanel market={makeMarketView()} me={makeMyMarket()} signInHref="/sign-in" />);
    fireEvent.click(screen.getByRole("radio", { name: /Soulkey/ }));
    fireEvent.change(screen.getByLabelText("Minerals to spend"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Buy Soulkey" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Bought 8.40 shares for 5 minerals"),
    );
    expect(placeTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        marketId: 1,
        outcomeIdx: 1,
        mode: "buy_spend",
        amount: 5,
        maxCost: 5,
        idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    );
  });

  it("shows the ledger's reason when a trade is refused", async () => {
    vi.mocked(placeTrade).mockResolvedValue({ error: { code: "INSUFFICIENT_FUNDS" } });
    renderPanel(
      <TradePanel
        market={makeMarketView()}
        me={makeMyMarket({ balance: 2 })}
        signInHref="/sign-in"
      />,
    );
    fireEvent.change(screen.getByLabelText("Minerals to spend"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Buy Rush" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("You don't have enough minerals"),
    );
  });

  it("only lets you sell shares you hold", () => {
    renderPanel(
      <TradePanel
        market={makeMarketView()}
        me={makeMyMarket({ shares: { 0: 2 } })}
        signInHref="/sign-in"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sell" }));
    fireEvent.change(screen.getByLabelText(/Shares to sell \(you hold 2\.00\)/), {
      target: { value: "3" },
    });
    expect(screen.getByText("You can only sell shares you hold.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sell Rush" })).toBeDisabled();
  });
});
