import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

type QueryProviderProps = {
    children: ReactNode;
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});

export default function QueryClientProviderComponent({
    children,
}: QueryProviderProps) {
    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

export { queryClient };
