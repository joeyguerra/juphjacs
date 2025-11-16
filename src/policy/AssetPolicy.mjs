import { minimatch } from 'minimatch'

/** @enum {string} */
const AssetType = {
  HTML: 'html',
  MARKDOWN: 'markdown',
  PAGE_MODULE: 'page-module',
  CSS: 'css',
  JS: 'js',
  XML: 'xml',
  DATA: 'data',
  ASSET: 'asset',
  UNKNOWN: 'unknown'
}

/** @enum {string} */
const HmrStrategy = {
  CSS_ONLY: 'css-only',
  DOM_MORPH: 'dom-morph',
  FULL_RELOAD: 'full-reload',
  NONE: 'none'
}

class AssetPolicy {
  getAssetType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase()

    const typeMap = {
      html: AssetType.HTML,
      htm: AssetType.HTML,
      md: AssetType.MARKDOWN,
      markdown: AssetType.MARKDOWN,
      js: AssetType.JS,
      mjs: AssetType.JS,
      cjs: AssetType.JS,
      css: AssetType.CSS,
      xml: AssetType.XML,
      rss: AssetType.XML,
      atom: AssetType.XML,
      png: AssetType.ASSET,
      jpg: AssetType.ASSET,
      jpeg: AssetType.ASSET,
      gif: AssetType.ASSET,
      svg: AssetType.ASSET,
      webp: AssetType.ASSET,
      ico: AssetType.ASSET,
      woff: AssetType.ASSET,
      woff2: AssetType.ASSET,
      ttf: AssetType.ASSET,
      eot: AssetType.ASSET,
      otf: AssetType.ASSET,
      mp4: AssetType.ASSET,
      webm: AssetType.ASSET,
      mp3: AssetType.ASSET,
      wav: AssetType.ASSET,
      pdf: AssetType.ASSET,
      zip: AssetType.ASSET,
      json: AssetType.DATA
    }

    return typeMap[ext] || AssetType.UNKNOWN
  }

  needsTemplateRendering(filePath) {
    const type = this.getAssetType(filePath)
    return type === AssetType.HTML || type === AssetType.MARKDOWN
  }

  needsMarkdownProcessing(filePath) {
    const type = this.getAssetType(filePath)
    return type === AssetType.MARKDOWN
  }

  shouldCopyAsIs(filePath) {
    const type = this.getAssetType(filePath)
    return type === AssetType.ASSET || type === AssetType.DATA
  }

  getHmrStrategy(filePath) {
    const assetType = this.getAssetType(filePath)

    switch (assetType) {
      case AssetType.CSS:
        return HmrStrategy.CSS_ONLY
      case AssetType.JS:
        return HmrStrategy.FULL_RELOAD
      case AssetType.HTML:
      case AssetType.MARKDOWN:
        return HmrStrategy.DOM_MORPH
      default:
        return HmrStrategy.NONE
    }
  }

  getMeta(filePath) {
    const assetType = this.getAssetType(filePath)
    const hmrStrategy = this.getHmrStrategy(filePath)
    return { assetType, hmrStrategy }
  }
}

export { AssetPolicy, AssetType, HmrStrategy }
