/** Routes that need request collections, open tabs, and workspace selection controls. */
export const isWorkbenchRoute = (pathname: string) => /^\/w\/[^/]+\/(request|grpc)\//.test(pathname)

export const isRequestTabRoute = (pathname: string) => /\/w\/[^/]+\/(request|grpc)\//.test(pathname)
