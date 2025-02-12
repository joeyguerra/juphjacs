

export default async () => {
    return async (request, response) => {
        response.render = async (page) => {
            response.setHeader('Content-Type', page.contentType)
            await page.render(page)
            response.end(page.output)
        }
    }
}