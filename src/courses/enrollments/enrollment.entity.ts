import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { User } from '../../users/user.entity'
import { Course } from '../course.entity'
import { EnrollmentStatus } from './enums/enrollment-status.enum'

@Entity({ name: 'enrollments' })
@Index('enrollments_course_student_unique', ['courseId', 'studentId'], {
  unique: true,
})
@Index('enrollments_course_id_idx', ['courseId'])
@Index('enrollments_student_id_idx', ['studentId'])
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course!: Course

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: User

  @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    enumName: 'enrollment_status',
    default: EnrollmentStatus.Active,
  })
  status!: EnrollmentStatus

  @Column({ name: 'progress_percent', type: 'smallint', default: 0 })
  progressPercent!: number

  @CreateDateColumn({ name: 'enrolled_at', type: 'timestamptz' })
  enrolledAt!: Date

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
