"""Pydantic schemas."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime, date


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_name: str
    department_id: Optional[str] = None
    designation: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role_name: Optional[str] = None
    status: Optional[str] = None
    department_id: Optional[str] = None
    designation: Optional[str] = None


class EntityCreate(BaseModel):
    entity_name: str
    entity_type: str
    business_owner_id: Optional[str] = None
    it_owner_id: Optional[str] = None
    criticality: str = "Medium"
    audit_frequency: str = "Annual"
    risk_score: float = 0.0
    metadata: Dict[str, Any] = {}


class ApplicationCreate(BaseModel):
    app_name: str
    business_owner_id: Optional[str] = None
    technical_owner_id: Optional[str] = None
    criticality: str = "Medium"
    data_sensitivity: str = "Internal"
    technology_stack: List[str] = []
    environment: str = "Prod"
    hosting_type: str = "Cloud"


class VendorCreate(BaseModel):
    vendor_name: str
    service_type: str
    criticality: str = "Medium"
    data_access_level: str = "Read"
    contract_start: Optional[str] = None
    contract_end: Optional[str] = None


class ControlCreate(BaseModel):
    control_name: str
    control_code: str
    category: str
    description: str
    frequency: str = "Monthly"
    severity: str = "Medium"
    testing_method: str = "Manual"
    evidence_required: List[str] = []
    risk_if_failed: str = ""
    framework_mappings: List[Dict[str, str]] = []


class RiskCreate(BaseModel):
    title: str
    description: str
    category: str
    severity: str = "Medium"
    likelihood: int = 3
    impact: int = 3
    control_weakness_factor: float = 1.0
    owner_id: Optional[str] = None
    business_impact: Optional[str] = None
    financial_impact: Optional[float] = 0
    affected_entity_ids: List[str] = []


class ObservationCreate(BaseModel):
    audit_id: Optional[str] = None
    control_id: Optional[str] = None
    title: str
    description: str
    severity: str
    root_cause: Optional[str] = None
    risk_impact: Optional[str] = None
    business_impact: Optional[str] = None
    financial_impact: Optional[float] = 0
    owner_id: Optional[str] = None


class ObservationUpdate(BaseModel):
    management_response: Optional[str] = None
    auditor_review: Optional[str] = None
    status: Optional[str] = None


class RemediationCreate(BaseModel):
    observation_id: str
    action_plan: str
    owner_id: Optional[str] = None
    target_date: Optional[str] = None
    priority: str = "Medium"


class RemediationUpdate(BaseModel):
    progress: Optional[int] = None
    closure_status: Optional[str] = None
    action_plan: Optional[str] = None


class AuditCreate(BaseModel):
    audit_name: str
    audit_type: str
    framework: str
    scope_description: Optional[str] = None
    objective: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    audit_manager_id: Optional[str] = None


class PolicyCreate(BaseModel):
    policy_name: str
    policy_code: str
    policy_type: str
    owner_id: Optional[str] = None
    version: str = "1.0"
    effective_date: Optional[str] = None
    next_review_date: Optional[str] = None
    content: str


class CopilotMessage(BaseModel):
    question: str
    conversation_id: Optional[str] = None


class StateTransition(BaseModel):
    new_status: str
    note: Optional[str] = None
