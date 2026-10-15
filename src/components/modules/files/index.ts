/** The files module's public surface. */
export { FileLibrary, StorageMeter, UploadFilesAction } from './file-library'
export type { FileLibraryProps } from './file-library'

export { CalendarPanel } from './calendar-panel'
export type { CalendarPanelProps } from './calendar-panel'
export { FileDetailsDialog } from './file-dialogs'
export { downloadTripFile } from './download'
export { kindForFile, screenFiles } from './screening'
export { uploadFile } from './upload'
export type { UploadAnswer, UploadInput } from './upload'

export {
  activeTasks,
  announcementsFor,
  emptyUploadQueue,
  failedTasks,
  isUploading,
  nextQueued,
  overallProgress,
  pendingBytes,
  settledTasks,
  uploadQueueReducer,
} from './upload-queue'
export type {
  UploadAnnouncement,
  UploadQueueAction,
  UploadQueueState,
  UploadStatus,
  UploadTask,
} from './upload-queue'

export type { FileData, FilePerson } from './types'
