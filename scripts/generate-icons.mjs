import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const sizes = [16, 32, 48, 128]
const outputDirectory = 'public/icons'

await mkdir(outputDirectory, { recursive: true })

await Promise.all(
  sizes.map((size) =>
    sharp('assets/extension-icon.svg')
      .resize(size, size)
      .png()
      .toFile(path.join(outputDirectory, `icon-${size}.png`)),
  ),
)
