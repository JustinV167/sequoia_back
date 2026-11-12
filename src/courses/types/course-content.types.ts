/**
 * JSON payloads stored with a course template. The API treats them as opaque
 * documents: the course editor owns their shape.
 */
export type CourseDesignContent = Record<string, unknown>
export type CourseModuleContent = Record<string, unknown>
