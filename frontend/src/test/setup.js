import '@testing-library/jest-dom'

// heic2any mock
vi.mock('heic2any', () => ({
  default: vi.fn().mockResolvedValue(new Blob(['dummy'], { type: 'image/jpeg' }))
}))

// Worker mock
global.Worker = class {
  constructor() {}
  postMessage() {}
  terminate() {}
}