const { execFileSync, spawn } = require('node:child_process');

const POWERSHELL = 'powershell.exe';
const POWERSHELL_ARGUMENTS = ['-NoProfile', '-NonInteractive', '-Command'];
const FRAME_DELAY_MS = 16;
const POWERSHELL_OPTIONS = {
  windowsHide: true
};

const CURSOR_WORKER_SCRIPT = String.raw`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$frameDelayMs = ${FRAME_DELAY_MS}

[Console]::Out.WriteLine("READY")
[Console]::Out.Flush()

while ($null -ne ($line = [Console]::In.ReadLine())) {
    try {
        $request = $line | ConvertFrom-Json

        if ($request.type -eq "position") {
            $position = [System.Windows.Forms.Cursor]::Position
            [Console]::Out.WriteLine("POSITION $($position.X) $($position.Y)")
        }
        elseif ($request.type -eq "move") {
            $start = [System.Windows.Forms.Cursor]::Position
            $targetX = [int]$request.x
            $targetY = [int]$request.y
            $curveOffset = [double]$request.curveOffset
            $durationMs = [int]$request.durationMs
            $deltaX = $targetX - $start.X
            $deltaY = $targetY - $start.Y
            $distance = [Math]::Sqrt($deltaX * $deltaX + $deltaY * $deltaY)
            $steps = [Math]::Max(1, [int][Math]::Ceiling($durationMs / [double]$frameDelayMs))
            $delayMs = [Math]::Max(1, [int][Math]::Round($durationMs / [double]$steps))

            for ($step = 1; $step -le $steps; $step++) {
                $progress = $step / [double]$steps
                $smoothProgress = $progress * $progress * (3 - 2 * $progress)
                $curveProgress = [Math]::Sin([Math]::PI * $progress) * $curveOffset

                if ($distance -gt 0) {
                    $perpendicularX = -$deltaY / $distance
                    $perpendicularY = $deltaX / $distance
                }
                else {
                    $perpendicularX = 0
                    $perpendicularY = 0
                }

                $x = [int][Math]::Round($start.X + $deltaX * $smoothProgress + $perpendicularX * $curveProgress)
                $y = [int][Math]::Round($start.Y + $deltaY * $smoothProgress + $perpendicularY * $curveProgress)
                [System.Windows.Forms.Cursor]::Position = New-Object -TypeName System.Drawing.Point -ArgumentList $x,$y

                if ($step -lt $steps) {
                    [System.Threading.Thread]::Sleep($delayMs)
                }
            }

            [Console]::Out.WriteLine("DONE")
        }

        [Console]::Out.Flush()
    }
    catch {
        [Console]::Out.WriteLine("ERROR $($_.Exception.Message)")
        [Console]::Out.Flush()
    }
}
`;

function createWindowsCursor() {
  const screenBounds = readPrimaryScreenBounds();
  let workerProcess;
  let workerIsReady = false;
  let outputBuffer = '';
  let pendingRequest;
  const queuedRequests = [];
  let closed = false;

  startWorker();

  return {
    getScreenBounds() {
      return screenBounds;
    },
    getPosition() {
      return sendRequest({ type: 'position' });
    },
    moveTo(position, movementPlan) {
      return sendRequest({
        type: 'move',
        x: position.x,
        y: position.y,
        durationMs: movementPlan.durationMs,
        curveOffset: movementPlan.curveOffset
      });
    },
    cancelMovement() {
      cancelWorkerRequest();
    },
    close() {
      closed = true;
      rejectAllRequests(new Error('Cursor control is closed.'));
      terminateWorker();
    }
  };

  function startWorker() {
    const worker = spawn(
      POWERSHELL,
      [...POWERSHELL_ARGUMENTS, CURSOR_WORKER_SCRIPT],
      { ...POWERSHELL_OPTIONS, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    workerProcess = worker;
    let standardError = '';

    worker.stdout.setEncoding('utf8');
    worker.stdout.on('data', handleWorkerOutput);
    worker.stderr.setEncoding('utf8');
    worker.stderr.on('data', output => {
      standardError += output;
    });
    worker.on('error', error => {
      if (workerProcess !== worker) {
        return;
      }
      rejectAllRequests(error);
    });
    worker.on('close', code => {
      if (workerProcess !== worker) {
        return;
      }

      workerIsReady = false;
      workerProcess = undefined;

      if (!closed && pendingRequest) {
        const message = standardError.trim() || `PowerShell exited with code ${code}.`;
        rejectAllRequests(new Error(message));
      }
    });
  }

  function sendRequest(request) {
    if (closed) {
      return Promise.reject(new Error('Cursor control is already closed.'));
    }

    return new Promise((resolve, reject) => {
      queuedRequests.push({ request, resolve, reject });
      if (!workerProcess) {
        startWorker();
      }
      sendNextRequest();
    });
  }

  function sendNextRequest() {
    if (!workerProcess || !workerIsReady || pendingRequest || queuedRequests.length === 0) {
      return;
    }

    pendingRequest = queuedRequests.shift();
    workerProcess.stdin.write(`${JSON.stringify(pendingRequest.request)}\n`);
  }

  function handleWorkerOutput(output) {
    outputBuffer += output;
    const lines = outputBuffer.split(/\r?\n/);
    outputBuffer = lines.pop();

    for (const line of lines) {
      handleWorkerLine(line.trim());
    }
  }

  function handleWorkerLine(line) {
    if (!line) {
      return;
    }

    if (line === 'READY') {
      workerIsReady = true;
      sendNextRequest();
      return;
    }

    if (!pendingRequest) {
      return;
    }

    if (line === 'DONE') {
      completeRequest();
      return;
    }

    if (line.startsWith('POSITION ')) {
      try {
        completeRequest(null, parseWorkerPosition(line));
      } catch (error) {
        completeRequest(error);
      }
      return;
    }

    if (line.startsWith('ERROR ')) {
      completeRequest(new Error(line.slice('ERROR '.length)));
    }
  }

  function completeRequest(error, result) {
    const request = pendingRequest;
    pendingRequest = undefined;

    if (error) {
      request.reject(error);
    } else {
      request.resolve(result);
    }

    sendNextRequest();
  }

  function cancelWorkerRequest() {
    if (!pendingRequest) {
      return;
    }

    rejectAllRequests(new Error('Cursor movement was cancelled.'));
    terminateWorker();

    if (!closed) {
      startWorker();
    }
  }

  function rejectAllRequests(error) {
    if (pendingRequest) {
      pendingRequest.reject(error);
      pendingRequest = undefined;
    }

    while (queuedRequests.length > 0) {
      queuedRequests.shift().reject(error);
    }
  }

  function terminateWorker() {
    if (workerProcess) {
      workerProcess.kill();
      workerProcess = undefined;
    }
    workerIsReady = false;
  }
}

function readPrimaryScreenBounds() {
  const command = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    'Write-Output "$($bounds.X),$($bounds.Y),$($bounds.Width),$($bounds.Height)"'
  ].join('; ');
  const output = execFileSync(
    POWERSHELL,
    [...POWERSHELL_ARGUMENTS, command],
    { ...POWERSHELL_OPTIONS, encoding: 'utf8' }
  );

  return parseScreenBounds(output);
}

function parseScreenBounds(output) {
  const [left, top, width, height] = output
    .trim()
    .split(',')
    .map(Number);

  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error(`PowerShell returned an invalid screen size: ${output.trim()}`);
  }

  return { left, top, width, height };
}

function parseWorkerPosition(line) {
  const [, x, y] = line.match(/^POSITION (-?\d+) (-?\d+)$/) || [];

  if (x === undefined || y === undefined) {
    throw new Error(`PowerShell returned an invalid cursor position: ${line}`);
  }

  return { x: Number(x), y: Number(y) };
}

module.exports = {
  createWindowsCursor,
  parseScreenBounds,
  parseWorkerPosition
};
