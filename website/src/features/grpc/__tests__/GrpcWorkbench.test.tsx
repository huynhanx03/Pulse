import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import GrpcWorkbench from '@/features/grpc/GrpcWorkbench'
import { i18n } from '@/lib/i18n/i18n'
import { usePulseStore } from '@/state/pulse-store'

const renderPage = () => {
  render(
    <MemoryRouter initialEntries={['/w/ws-core/grpc/req-grpc-profile']}>
      <Routes>
        <Route path="/w/:workspaceId/grpc/:requestId" element={<GrpcWorkbench />} />
      </Routes>
    </MemoryRouter>,
  )
  return userEvent.setup()
}

describe('gRPC workbench states', () => {
  beforeEach(async () => {
    usePulseStore.getState().resetWorkspace()
    usePulseStore.getState().selectRequest('req-grpc-profile')
    await i18n.changeLanguage('en')
  })

  afterEach(cleanup)

  it('shows importing and ready states while validating a proto file', async () => {
    let resolveText: ((value: string) => void) | undefined
    const user = renderPage()
    const file = new File(['pending'], 'users.proto', { type: 'text/plain' })
    Object.defineProperty(file, 'text', {
      value: () =>
        new Promise<string>((resolve) => {
          resolveText = resolve
        }),
    })

    await user.upload(screen.getByLabelText('Import .proto', { selector: 'input' }), file)
    expect(screen.getByTitle('reflection · Validating .proto')).toBeInTheDocument()

    resolveText?.('service UserService { rpc GetUser (GetUserRequest) returns (User); }')
    await waitFor(() => expect(screen.getByTitle('proto · Definition ready')).toBeInTheDocument())
    expect(usePulseStore.getState().data.grpcDefinitions).toHaveLength(2)
    expect(
      usePulseStore.getState().data.requests.find((request) => request.id === 'req-grpc-profile'),
    ).toMatchObject({ grpcType: 'unary', grpcMethodId: expect.stringMatching(/^grpc-/) })
  })

  it('keeps cancellation explicit when it happens before a stream result exists', async () => {
    usePulseStore.setState({
      executionState: 'resolving',
      grpcSessionState: 'connecting',
      lastGrpcResult: null,
    })
    const user = renderPage()

    await user.click(screen.getByRole('button', { name: 'Cancel stream' }))

    expect(usePulseStore.getState().grpcSessionState).toBe('cancelled')
    expect(screen.getByText('1 CANCELLED')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Stream cancelled' })).toBeInTheDocument()
    expect(
      screen.queryByText('Invoke the RPC to inspect its message stream.'),
    ).not.toBeInTheDocument()
  })

  it('explains the selected RPC call behavior before invocation', () => {
    renderPage()

    expect(screen.getByText('1 request → response stream')).toBeInTheDocument()
    expect(screen.getByText(/Call behavior/)).toBeInTheDocument()
  })
})
