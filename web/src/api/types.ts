// Os tipos vêm direto do backend: se um DTO mudar, o frontend deixa de compilar
export type {
  EventDTO,
  MapDTO,
  OrientationDTO,
  ProgramKindDTO,
  RobotStatusDTO,
  SimulationDTO,
} from '../../../src/application/dto.js';
export type { OrderResult } from '../../../src/application/use-cases/ExecuteOrders.js';
export type { LoadScriptResult } from '../../../src/application/use-cases/LoadScript.js';
export type { ForgetMapResult } from '../../../src/application/use-cases/ForgetMap.js';
export type { StopProgramResult } from '../../../src/application/use-cases/StopProgram.js';
export type { ClockDTO } from '../../../src/presentation/http/Clock.js';
export type { UpdateMessage } from '../../../src/presentation/http/SimulationController.js';
