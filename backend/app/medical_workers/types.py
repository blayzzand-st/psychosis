from enum import StrEnum


class MedicalWorkerRole(StrEnum):
    DOCTOR = "doctor"
    LABORATORY_TECHNICIAN = "laboratory-technician"
    NURSE = "nurse"
    OTHER = "other"
