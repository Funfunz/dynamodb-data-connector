import type { ISettings } from '@funfunz/core/lib/generator/configurationTypes'

export function getPKs(entity: string, settings: ISettings): string[] | undefined {
  let pks: string[] | undefined
  settings.some(
    (settingsEntity) => {
      const found = settingsEntity.name === entity
      if (found) {
        pks = settingsEntity.properties.filter(
          (property) => property.model.isPk
        ).map(
          (property) => property.name
        )
      }
      return found
    }
  )
  return pks
}