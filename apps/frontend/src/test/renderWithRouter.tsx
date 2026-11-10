import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"

/**
 * Renders a component that uses router links (e.g. a quack's link to its
 * thread) inside a throwaway in-memory router. The router renders
 * asynchronously, so this resolves once `ui` is on screen.
 */
export async function renderWithRouter(
  ui: ReactNode,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <div data-testid="router-ready">{ui}</div>
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  const result = render(<RouterProvider router={router} />)
  await screen.findByTestId("router-ready")
  return { ...result, router, queryClient }
}
