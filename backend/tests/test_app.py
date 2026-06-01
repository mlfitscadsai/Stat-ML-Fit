import pytest
import io
import json
import pandas as pd
import builtins
import os
import app
from helpers.ssh_client import HpcNotConfiguredError


def test_health(client):
    response = client.get('/health')
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['status'] == 'ok'
    assert 'hpc_configured' in payload


def test_run_without_hpc_returns_503(client, mocker):
    mocker.patch('app.get_ssh_client', side_effect=HpcNotConfiguredError('not configured'))
    response = client.get('/run?file_name=test.csv&job_id=2025')
    assert response.status_code == 503
    assert response.get_json()['hpc_configured'] is False


def test_upload_success(client, mocker):
    mocker.patch('app.os.path.join', return_value='files/test.csv')
    mock_save = mocker.patch('werkzeug.datastructures.FileStorage.save')
    
    data = {'file': (io.BytesIO(b"my file contents"), 'test.csv')}
    response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 200
    mock_save.assert_called_once()

def test_upload_invalid(client):
    data = {'file': (io.BytesIO(b"my file contents"), 'test.txt')}
    response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 400

def test_execute_success(client, mocker):
    mock_ssh_client = mocker.patch('app.get_ssh_client')
    mock_ssh = mock_ssh_client.return_value
    
    mock_stdin = mocker.MagicMock()
    mock_stdout = mocker.MagicMock()
    mock_stdout.read.return_value.decode.return_value = 'output'
    mock_stderr = mocker.MagicMock()
    mock_stderr.read.return_value.decode.return_value = 'error'
    
    mock_ssh.exec_command.return_value = (mock_stdin, mock_stdout, mock_stderr)
    
    mocker.patch('app.remote_dir_exists', return_value=False)
    mocker.patch('app.os.remove')
    
    mock_open = mocker.mock_open()
    mocker.patch('builtins.open', mock_open)
    
    response = client.get('/run?file_name=test.csv&method_name=test&seed=42&target=target_col&job_id=2025')
    assert response.status_code == 200
    assert response.get_json()["status"] == "submitted"
    assert response.get_json()["job_id"] == "2025"

def test_progress_ongoing(client, mocker):
    mocker.patch('app.get_ssh_client')
    mocker.patch('app.remote_dir_exists', return_value=False)
    
    response = client.get('/progress?job_id=2025')
    assert response.status_code == 200
    assert response.get_json() == {"job_id": "2025", "status": "running"}

def test_progress_finished(client, mocker):
    mock_ssh = mocker.patch('app.get_ssh_client')
    mocker.patch('app.remote_dir_exists', return_value=True)
    mocker.patch('app.os.path.abspath', return_value='/tmp')
    
    mock_open = mocker.mock_open(read_data='{"status": "done"}')
    mocker.patch('builtins.open', mock_open)
    
    response = client.get('/progress?job_id=2025')
    assert response.status_code == 200
    assert response.get_json()["status"] == "completed"
    assert response.get_json()["job_id"] == "2025"
    assert response.get_json()["result"] == {"status": "done"}

def test_jobs_status_endpoint(client, mocker):
    mocker.patch('app.get_ssh_client')
    mocker.patch('app.remote_dir_exists', return_value=False)

    response = client.get('/jobs/abc123')

    assert response.status_code == 200
    assert response.get_json() == {"job_id": "abc123", "status": "running"}

def test_jobs_cancel_endpoint(client, mocker):
    mock_ssh_client = mocker.patch('app.get_ssh_client')
    mock_ssh = mock_ssh_client.return_value
    mock_stdout = mocker.MagicMock()
    mock_stdout.read.return_value.decode.return_value = 'cancelled'
    mock_stderr = mocker.MagicMock()
    mock_stderr.read.return_value.decode.return_value = ''
    mock_ssh.exec_command.return_value = (mocker.MagicMock(), mock_stdout, mock_stderr)

    response = client.post('/jobs/abc123/cancel', json={"slurm_job_id": "987"})

    assert response.status_code == 200
    assert response.get_json()["status"] == "cancelled"
    mock_ssh.exec_command.assert_called_once_with('scancel 987')

def test_imputation(client, mocker):
    mock_mf = mocker.patch('app.MissForest')
    mock_instance = mock_mf.return_value
    mock_instance.fit_transform.return_value = pd.DataFrame([{'a': 1, 'b': 2}])
    mocker.patch('app.RandomForestClassifier')
    mocker.patch('app.RandomForestRegressor')
    
    data = {
        'data': [{'a': 1, 'b': None}],
        'categoricalFeatures': []
    }
    response = client.post('/missforest', json=data)
    assert response.status_code == 200
    assert json.loads(response.data) == [{'a': 1, 'b': 2}]
