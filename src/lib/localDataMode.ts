const LOCAL_DATA_MODE_KEY = 'kanban-board:e2e'

export const isLocalDataMode = () => {
  try {
    return localStorage.getItem(LOCAL_DATA_MODE_KEY) === 'true'
  } catch {
    return false
  }
}
